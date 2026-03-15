from __future__ import annotations

import base64
import hashlib
import importlib.util
import json
import os
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.config import Settings


SUPPORTED_PROVIDER_TASKS: tuple[str, ...] = (
    "research",
    "assignments",
    "feedback",
    "planning",
    "review",
    "export",
    "classroom",
)

PROVIDER_CATALOG: tuple[dict[str, Any], ...] = (
    {
        "provider_id": "openai",
        "label": "OpenAI",
        "sdk_package": "openai",
        "docs_url": "https://platform.openai.com/docs/libraries/python",
        "default_model": "gpt-5-mini",
        "recommended_models": ["gpt-5-mini", "gpt-5"],
        "supports_custom_base_url": True,
        "supports_managed_subscription": True,
        "notes": "Best for general research, writing, planning, and structured educational workflows.",
    },
    {
        "provider_id": "anthropic",
        "label": "Anthropic",
        "sdk_package": "anthropic",
        "docs_url": "https://docs.anthropic.com/en/api/client-sdks#python",
        "default_model": "claude-sonnet-4-5",
        "recommended_models": ["claude-sonnet-4-5", "claude-opus-4-1"],
        "supports_custom_base_url": True,
        "supports_managed_subscription": True,
        "notes": "Strong for analysis, long-form reasoning, feedback, and classroom-safe drafting.",
    },
    {
        "provider_id": "google",
        "label": "Google Gemini",
        "sdk_package": "google-genai",
        "docs_url": "https://ai.google.dev/gemini-api/docs/quickstart?lang=python",
        "default_model": "gemini-2.5-flash",
        "recommended_models": ["gemini-2.5-flash", "gemini-2.5-pro"],
        "supports_custom_base_url": False,
        "supports_managed_subscription": True,
        "notes": "Useful for multimodal classroom work and general content generation.",
    },
    {
        "provider_id": "groq",
        "label": "Groq",
        "sdk_package": "groq",
        "docs_url": "https://console.groq.com/docs/libraries#python-library",
        "default_model": "llama-3.3-70b-versatile",
        "recommended_models": ["llama-3.3-70b-versatile", "mixtral-8x7b-32768"],
        "supports_custom_base_url": True,
        "supports_managed_subscription": True,
        "notes": "Fast inference path for classroom tooling, drafting, and quick research assistance.",
    },
    {
        "provider_id": "mistral",
        "label": "Mistral",
        "sdk_package": "mistralai",
        "docs_url": "https://docs.mistral.ai/getting-started/clients/#python",
        "default_model": "mistral-medium-latest",
        "recommended_models": ["mistral-medium-latest", "mistral-large-latest"],
        "supports_custom_base_url": False,
        "supports_managed_subscription": True,
        "notes": "Good for multilingual drafting, summaries, and educational writing support.",
    },
    {
        "provider_id": "cohere",
        "label": "Cohere",
        "sdk_package": "cohere",
        "docs_url": "https://docs.cohere.com/docs/chat-api",
        "default_model": "command-a-03-2025",
        "recommended_models": ["command-a-03-2025", "command-r-plus-08-2024"],
        "supports_custom_base_url": False,
        "supports_managed_subscription": True,
        "notes": "Useful for retrieval-grounded assistance, summarization, and report generation.",
    },
    {
        "provider_id": "xai",
        "label": "xAI",
        "sdk_package": "xai-sdk",
        "docs_url": "https://docs.x.ai/docs/sdk",
        "default_model": "grok-3-mini",
        "recommended_models": ["grok-3-mini", "grok-3"],
        "supports_custom_base_url": False,
        "supports_managed_subscription": True,
        "notes": "Useful for Grok-backed research assistance and planning flows.",
    },
)


class ProviderAIService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.root_dir = settings.studio_root_dir / "ai_control_plane"
        self.profiles_path = self.root_dir / "profiles.json"
        self.usage_path = self.root_dir / "usage_log.json"
        self.root_dir.mkdir(parents=True, exist_ok=True)
        if not self.profiles_path.exists():
            self._write_json(self.profiles_path, [])
        if not self.usage_path.exists():
            self._write_json(self.usage_path, [])
        self._aes = AESGCM(self._derive_encryption_key(settings.educlawn_security_secret))

    def provider_catalog(self) -> list[dict[str, Any]]:
        entries = []
        for provider in PROVIDER_CATALOG:
            entry = dict(provider)
            entry["sdk_installed"] = self._sdk_installed(provider["provider_id"])
            entry["supported_tasks"] = list(SUPPORTED_PROVIDER_TASKS)
            entries.append(entry)
        return entries

    def list_profiles(self) -> list[dict[str, Any]]:
        profiles = [self._sanitize_profile(profile) for profile in self._load_profiles()]
        return sorted(profiles, key=lambda item: item["updated_at"], reverse=True)

    def create_profile(self, payload: dict[str, Any]) -> dict[str, Any]:
        provider = self._catalog_by_id(str(payload["provider_id"]))
        api_key = str(payload.get("api_key") or "").strip()
        if len(api_key) < 8:
            raise ValueError("API key is required.")
        now = self._timestamp()
        profile = {
            "profile_id": f"ai-profile-{uuid4().hex[:10]}",
            "label": str(payload["label"]).strip(),
            "provider_id": provider["provider_id"],
            "auth_mode": self._normalize_auth_mode(str(payload.get("auth_mode") or "user-key")),
            "default_model": str(payload.get("default_model") or provider["default_model"]).strip(),
            "base_url": str(payload.get("base_url") or "").strip(),
            "capabilities": self._normalize_capabilities(payload.get("capabilities")),
            "api_key_ciphertext": self._encrypt_secret(api_key),
            "api_key_hint": self._mask_secret(api_key),
            "created_at": now,
            "updated_at": now,
            "last_tested_at": "",
            "last_test_status": "never",
            "last_error": "",
        }
        profiles = self._load_profiles()
        profiles.insert(0, profile)
        self._write_json(self.profiles_path, profiles)
        return self._sanitize_profile(profile)

    def update_profile(self, profile_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        profiles = self._load_profiles()
        for profile in profiles:
            if profile["profile_id"] != profile_id:
                continue
            if "label" in payload:
                profile["label"] = str(payload["label"]).strip()
            if "auth_mode" in payload:
                profile["auth_mode"] = self._normalize_auth_mode(str(payload["auth_mode"]))
            if "default_model" in payload and str(payload["default_model"]).strip():
                profile["default_model"] = str(payload["default_model"]).strip()
            if "base_url" in payload:
                profile["base_url"] = str(payload.get("base_url") or "").strip()
            if "capabilities" in payload:
                profile["capabilities"] = self._normalize_capabilities(payload.get("capabilities"))
            if payload.get("api_key"):
                api_key = str(payload["api_key"]).strip()
                profile["api_key_ciphertext"] = self._encrypt_secret(api_key)
                profile["api_key_hint"] = self._mask_secret(api_key)
            profile["updated_at"] = self._timestamp()
            self._write_json(self.profiles_path, profiles)
            return self._sanitize_profile(profile)
        raise FileNotFoundError(profile_id)

    def delete_profile(self, profile_id: str) -> None:
        profiles = self._load_profiles()
        remaining = [profile for profile in profiles if profile["profile_id"] != profile_id]
        if len(remaining) == len(profiles):
            raise FileNotFoundError(profile_id)
        self._write_json(self.profiles_path, remaining)

    def test_profile(self, profile_id: str) -> dict[str, Any]:
        result = self.generate_with_profile(
            profile_id,
            task="research",
            prompt="Reply with READY and a one-sentence description of what this provider is good at for classrooms.",
            system_prompt="You are validating an educational workspace AI connection.",
            source="profile_test",
        )
        self._update_test_status(profile_id, result)
        return result

    def recent_usage(self, limit: int = 25) -> list[dict[str, Any]]:
        entries = self._load_json(self.usage_path)
        return entries[:limit]

    def get_profile_summary(self, profile_id: str) -> dict[str, Any]:
        for profile in self._load_profiles():
            if profile["profile_id"] == profile_id:
                return self._sanitize_profile(profile)
        raise FileNotFoundError(profile_id)

    def generate_with_profile(
        self,
        profile_id: str,
        *,
        task: str,
        prompt: str,
        system_prompt: str = "",
        source: str = "workspace",
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        profile = self._load_profile(profile_id)
        provider = self._catalog_by_id(profile["provider_id"])
        generated_at = self._timestamp()
        try:
            output_text = self._invoke_provider(
                provider_id=profile["provider_id"],
                api_key=self._decrypt_secret(profile["api_key_ciphertext"]),
                model=profile["default_model"],
                prompt=prompt,
                system_prompt=system_prompt,
                base_url=str(profile.get("base_url") or ""),
            ).strip()
            if not output_text:
                raise RuntimeError("Provider returned an empty response.")
            result = {
                "used": True,
                "generated_at": generated_at,
                "provider_id": profile["provider_id"],
                "provider_label": provider["label"],
                "profile_id": profile["profile_id"],
                "profile_label": profile["label"],
                "auth_mode": profile["auth_mode"],
                "model": profile["default_model"],
                "output_text": output_text,
                "error": "",
            }
            self._append_usage(
                {
                    "usage_id": f"ai-usage-{uuid4().hex[:10]}",
                    "source": source,
                    "task": task,
                    "provider_id": profile["provider_id"],
                    "provider_label": provider["label"],
                    "profile_id": profile["profile_id"],
                    "profile_label": profile["label"],
                    "auth_mode": profile["auth_mode"],
                    "model": profile["default_model"],
                    "success": True,
                    "error": "",
                    "prompt_preview": prompt[:180],
                    "metadata": metadata or {},
                    "created_at": generated_at,
                }
            )
            return result
        except Exception as error:  # pragma: no cover - exercised through higher-level flows
            result = {
                "used": False,
                "generated_at": generated_at,
                "provider_id": profile["provider_id"],
                "provider_label": provider["label"],
                "profile_id": profile["profile_id"],
                "profile_label": profile["label"],
                "auth_mode": profile["auth_mode"],
                "model": profile["default_model"],
                "output_text": "",
                "error": str(error),
            }
            self._append_usage(
                {
                    "usage_id": f"ai-usage-{uuid4().hex[:10]}",
                    "source": source,
                    "task": task,
                    "provider_id": profile["provider_id"],
                    "provider_label": provider["label"],
                    "profile_id": profile["profile_id"],
                    "profile_label": profile["label"],
                    "auth_mode": profile["auth_mode"],
                    "model": profile["default_model"],
                    "success": False,
                    "error": str(error),
                    "prompt_preview": prompt[:180],
                    "metadata": metadata or {},
                    "created_at": generated_at,
                }
            )
            return result

    def _invoke_provider(
        self,
        *,
        provider_id: str,
        api_key: str,
        model: str,
        prompt: str,
        system_prompt: str,
        base_url: str = "",
    ) -> str:
        if provider_id == "openai":
            from openai import OpenAI

            client = OpenAI(api_key=api_key, base_url=base_url or None)
            response = client.responses.create(
                model=model,
                input=self._openai_input(system_prompt, prompt),
                max_output_tokens=900,
            )
            text = str(getattr(response, "output_text", "") or "").strip()
            if text:
                return text
            return json.dumps(response.model_dump(), indent=2)[:1200]

        if provider_id == "anthropic":
            from anthropic import Anthropic

            client = Anthropic(api_key=api_key, base_url=base_url or None)
            message = client.messages.create(
                model=model,
                max_tokens=900,
                system=system_prompt or None,
                messages=[{"role": "user", "content": prompt}],
            )
            return "\n".join(
                block.text for block in getattr(message, "content", []) if getattr(block, "type", "") == "text"
            ).strip()

        if provider_id == "google":
            from google import genai

            client = genai.Client(api_key=api_key)
            response = client.models.generate_content(
                model=model,
                contents=self._joined_prompt(system_prompt, prompt),
            )
            text = str(getattr(response, "text", "") or "").strip()
            if text:
                return text
            return json.dumps(getattr(response, "model_dump", lambda: {})(), indent=2)[:1200]

        if provider_id == "groq":
            from groq import Groq

            client = Groq(api_key=api_key, base_url=base_url or None)
            response = client.chat.completions.create(
                model=model,
                messages=self._chat_messages(system_prompt, prompt),
                temperature=0.2,
                max_tokens=900,
            )
            return str(response.choices[0].message.content or "").strip()

        if provider_id == "mistral":
            from mistralai import Mistral

            client = Mistral(api_key=api_key)
            response = client.chat.complete(
                model=model,
                messages=self._chat_messages(system_prompt, prompt),
            )
            content = response.choices[0].message.content
            if isinstance(content, list):
                return "\n".join(
                    str(part.get("text") or "")
                    for part in content
                    if isinstance(part, dict)
                ).strip()
            return str(content or "").strip()

        if provider_id == "cohere":
            import cohere

            client = cohere.ClientV2(api_key=api_key)
            response = client.chat(
                model=model,
                messages=self._chat_messages(system_prompt, prompt),
            )
            message = getattr(response, "message", None)
            content = getattr(message, "content", []) if message is not None else []
            collected = []
            for part in content:
                text = getattr(part, "text", "")
                if text:
                    collected.append(str(text))
            return "\n".join(collected).strip()

        if provider_id == "xai":
            from xai_sdk import Client
            from xai_sdk.chat import system as xai_system
            from xai_sdk.chat import user as xai_user

            client = Client(api_key=api_key)
            messages = []
            if system_prompt.strip():
                messages.append(xai_system(system_prompt.strip()))
            messages.append(xai_user(prompt))
            chat = client.chat.create(model=model, messages=messages)
            response = chat.sample()
            return str(getattr(response, "content", "") or "").strip()

        raise ValueError(f"Unsupported provider: {provider_id}")

    def _update_test_status(self, profile_id: str, result: dict[str, Any]) -> None:
        profiles = self._load_profiles()
        for profile in profiles:
            if profile["profile_id"] != profile_id:
                continue
            profile["last_tested_at"] = result["generated_at"]
            profile["last_test_status"] = "passed" if result["used"] else "failed"
            profile["last_error"] = str(result.get("error") or "")
            profile["updated_at"] = self._timestamp()
            self._write_json(self.profiles_path, profiles)
            return

    def _load_profile(self, profile_id: str) -> dict[str, Any]:
        for profile in self._load_profiles():
            if profile["profile_id"] == profile_id:
                return profile
        raise FileNotFoundError(profile_id)

    def _load_profiles(self) -> list[dict[str, Any]]:
        return self._load_json(self.profiles_path)

    def _sanitize_profile(self, profile: dict[str, Any]) -> dict[str, Any]:
        provider = self._catalog_by_id(profile["provider_id"])
        return {
            "profile_id": profile["profile_id"],
            "label": profile["label"],
            "provider_id": profile["provider_id"],
            "provider_label": provider["label"],
            "auth_mode": profile["auth_mode"],
            "default_model": profile["default_model"],
            "base_url": profile.get("base_url") or "",
            "capabilities": list(profile.get("capabilities", [])),
            "api_key_hint": profile.get("api_key_hint") or "",
            "sdk_installed": self._sdk_installed(profile["provider_id"]),
            "last_tested_at": profile.get("last_tested_at") or "",
            "last_test_status": profile.get("last_test_status") or "never",
            "last_error": profile.get("last_error") or "",
            "created_at": profile["created_at"],
            "updated_at": profile["updated_at"],
        }

    def _catalog_by_id(self, provider_id: str) -> dict[str, Any]:
        for provider in PROVIDER_CATALOG:
            if provider["provider_id"] == provider_id:
                return dict(provider)
        raise KeyError(provider_id)

    def _sdk_installed(self, provider_id: str) -> bool:
        module_name = {
            "openai": "openai",
            "anthropic": "anthropic",
            "google": "google.genai",
            "groq": "groq",
            "mistral": "mistralai",
            "cohere": "cohere",
            "xai": "xai_sdk",
        }[provider_id]
        return importlib.util.find_spec(module_name) is not None

    def _normalize_capabilities(self, raw_value: Any) -> list[str]:
        items = raw_value if isinstance(raw_value, list) else []
        normalized = []
        for item in items:
            value = str(item).strip().lower().replace("_", "-")
            if value in SUPPORTED_PROVIDER_TASKS and value not in normalized:
                normalized.append(value)
        return normalized or ["research", "assignments", "feedback"]

    def _normalize_auth_mode(self, auth_mode: str) -> str:
        if auth_mode not in {"user-key", "managed-subscription"}:
            raise ValueError("Unsupported auth mode.")
        return auth_mode

    def _derive_encryption_key(self, secret: str) -> bytes:
        seed = f"{secret}|educlawn-provider-ai".encode("utf-8")
        return hashlib.sha256(seed).digest()

    def _encrypt_secret(self, value: str) -> str:
        nonce = os.urandom(12)
        ciphertext = self._aes.encrypt(nonce, value.encode("utf-8"), None)
        return base64.b64encode(nonce + ciphertext).decode("utf-8")

    def _decrypt_secret(self, value: str) -> str:
        raw = base64.b64decode(value.encode("utf-8"))
        nonce, ciphertext = raw[:12], raw[12:]
        return self._aes.decrypt(nonce, ciphertext, None).decode("utf-8")

    def _mask_secret(self, value: str) -> str:
        trimmed = value.strip()
        if len(trimmed) <= 8:
            return "*" * len(trimmed)
        return f"{trimmed[:4]}...{trimmed[-4:]}"

    def _append_usage(self, entry: dict[str, Any]) -> None:
        entries = self._load_json(self.usage_path)
        entries.insert(0, entry)
        self._write_json(self.usage_path, entries[:120])

    def _openai_input(self, system_prompt: str, prompt: str) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        if system_prompt.strip():
            items.append(
                {
                    "role": "system",
                    "content": [{"type": "input_text", "text": system_prompt.strip()}],
                }
            )
        items.append(
            {
                "role": "user",
                "content": [{"type": "input_text", "text": prompt}],
            }
        )
        return items

    def _chat_messages(self, system_prompt: str, prompt: str) -> list[dict[str, str]]:
        messages: list[dict[str, str]] = []
        if system_prompt.strip():
            messages.append({"role": "system", "content": system_prompt.strip()})
        messages.append({"role": "user", "content": prompt})
        return messages

    def _joined_prompt(self, system_prompt: str, prompt: str) -> str:
        if not system_prompt.strip():
            return prompt
        return f"{system_prompt.strip()}\n\n{prompt}"

    def _timestamp(self) -> str:
        return datetime.now(UTC).isoformat()

    def _load_json(self, path: Path) -> list[dict[str, Any]]:
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)

    def _write_json(self, path: Path, payload: list[dict[str, Any]]) -> None:
        with path.open("w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2)
