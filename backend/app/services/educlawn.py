from __future__ import annotations

import hashlib
import hmac
import json
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import yaml

from app.core.config import Settings
from app.services.education_os import EducationOperatingSystemService
from app.services.studio_engine import TemplateRegistryService


SAFE_CHANNEL_PRIORITY: tuple[str, ...] = (
    "webchat",
    "googlechat",
    "msteams",
    "slack",
    "discord",
    "mattermost",
    "matrix",
    "nextcloud-talk",
    "irc",
)

BLOCKED_OPENCLAW_FEATURES: tuple[str, ...] = (
    "phone-control",
    "voice-call",
    "talk-voice",
    "browser-control",
    "public-dm-automation",
    "silent-external-send",
)

EDUCLAWN_TOOL_ALLOWLIST: tuple[str, ...] = (
    "classroom_read",
    "assignment_read",
    "approved_evidence_search",
    "project_compile",
    "citation_map",
    "teacher_feedback",
    "approval_queue",
    "audit_review",
    "local_export",
)

EDUCLAWN_TOOL_DENYLIST: tuple[str, ...] = (
    "shell",
    "exec",
    "spawn",
    "sessions_spawn",
    "sessions_send",
    "gateway",
    "cron",
    "browser_navigation",
    "public_publish",
    "external_messaging",
    "fs_delete",
    "fs_move",
)


class EduClawnService:
    def __init__(
        self,
        settings: Settings,
        education_service: EducationOperatingSystemService,
        template_registry: TemplateRegistryService,
    ) -> None:
        self.settings = settings
        self.education_service = education_service
        self.template_registry = template_registry
        self.security_secret = settings.educlawn_security_secret.encode("utf-8")
        self.source_root = settings.openclaw_root_dir
        self.output_root = settings.studio_root_dir / "educlawn"
        self.output_root.mkdir(parents=True, exist_ok=True)

    def get_overview(self) -> dict[str, Any]:
        source = self.get_source_summary()
        templates = self.template_registry.list_templates()
        safe_channels = self._derive_safe_channels(source.get("channels", []))
        return {
            "product_name": "EduClawn",
            "tagline": "A school-safe local-first agent studio built from the OpenClaw product shape.",
            "source_summary": source,
            "product_shape": {
                "teacher_os": "Lesson planning, rubric design, review, and classroom dashboards.",
                "student_os": "Project building, research coaching, citation tutoring, and revision support.",
                "shared_layer": "Evidence libraries, approvals, audit logs, provenance, and versioned local exports.",
                "gateway": "Local control plane with pairing-first channels, classroom-safe sessions, and scoped tools.",
            },
            "derived_control_plane": {
                "allowed_channels": safe_channels,
                "blocked_features": list(BLOCKED_OPENCLAW_FEATURES),
                "allowed_tools": list(EDUCLAWN_TOOL_ALLOWLIST),
                "denied_tools": sorted(set(EDUCLAWN_TOOL_DENYLIST + tuple(source.get("dangerous_tools", [])))),
                "session_model": [
                    "teacher",
                    "student",
                    "assignment",
                    "classroom-shared",
                    "review",
                ],
                "pairing_policy": "pairing-required",
                "approval_policy": "required-for-sensitive-actions",
                "attestation": {
                    "algorithm": "hmac-sha256",
                    "material_policy": {
                        "max_material_bytes": self.settings.edu_material_max_bytes,
                    },
                    "config_integrity": "signed-control-plane",
                },
            },
            "education_templates": [
                {
                    "id": template["id"],
                    "label": template["label"],
                    "project_type": template["project_type"],
                    "category": template["category"],
                }
                for template in templates
            ],
            "implementation_status": {
                "desktop_app": True,
                "classroom_runtime": True,
                "bounded_agents": True,
                "approvals_and_audit": True,
                "openclaw_imported_locally": bool(source["available"]),
            },
        }

    def get_source_summary(self) -> dict[str, Any]:
        root = self.source_root
        if root is None or not root.exists():
            return {
                "available": False,
                "path": str(root) if root else "",
                "package_name": "",
                "version": "",
                "license": "",
                "node_requirement": "",
                "counts": {
                    "extensions": 0,
                    "skills": 0,
                    "apps": 0,
                    "channels": 0,
                },
                "channels": [],
                "skills": [],
                "dangerous_tools": [],
            }

        package = self._load_json(root / "package.json")
        channels = sorted(
            {
                path.stem
                for path in (root / "docs" / "channels").glob("*.md")
                if path.stem
                not in {
                    "index",
                    "groups",
                    "pairing",
                    "troubleshooting",
                    "group-messages",
                    "channel-routing",
                    "broadcast-groups",
                    "location",
                }
            }
        )
        skills = sorted(path.name for path in (root / "skills").glob("*") if path.is_dir())
        dangerous_tools = self._parse_dangerous_tools(root / "src" / "security" / "dangerous-tools.ts")
        node_requirement = self._parse_node_requirement(root / "openclaw.mjs")
        return {
            "available": True,
            "path": str(root),
            "package_name": str(package.get("name") or "openclaw"),
            "version": str(package.get("version") or ""),
            "license": str(package.get("license") or ""),
            "node_requirement": node_requirement,
            "counts": {
                "extensions": len([path for path in (root / "extensions").glob("*") if path.is_dir()]),
                "skills": len(skills),
                "apps": len([path for path in (root / "apps").glob("*") if path.is_dir()]),
                "channels": len(channels),
            },
            "channels": channels,
            "skills": skills[:24],
            "dangerous_tools": dangerous_tools,
            "key_paths": {
                "wizard": str(root / "src" / "wizard"),
                "gateway": str(root / "src" / "gateway"),
                "sessions": str(root / "src" / "sessions"),
                "security": str(root / "src" / "security"),
                "skills": str(root / "skills"),
            },
        }

    def bootstrap(self, payload: dict[str, Any]) -> dict[str, Any]:
        classroom = self.education_service.create_classroom(
            {
                "title": payload["classroom_title"],
                "subject": payload["subject"],
                "grade_band": payload["grade_band"],
                "teacher_name": payload["teacher_name"],
                "description": payload.get("description") or f"EduClawn classroom for {payload['school_name']}.",
                "default_template_id": payload.get("default_template_id") or "lesson-module",
                "standards_focus": payload.get("standards_focus", []),
            }
        )
        classroom_id = classroom["classroom_id"]
        security_bootstrap = classroom.get("security_bootstrap") or {}
        teacher_access_key = str(security_bootstrap.get("teacher_access_key") or "")
        assignment_title = str(payload.get("assignment_title") or f"{payload['subject']} Inquiry Project").strip()
        classroom = self.education_service.create_assignment(
            classroom_id,
            {
                "title": assignment_title,
                "summary": payload.get("assignment_summary") or "OpenClaw-derived local-first assignment workflow.",
                "topic": payload.get("topic") or payload["subject"],
                "audience": payload.get("audience") or payload["grade_band"],
                "template_id": payload.get("template_id") or payload.get("default_template_id") or "research-portfolio",
                "goals": payload.get("goals", []),
                "rubric": payload.get("rubric", []),
                "standards": payload.get("standards_focus", []),
                "due_date": payload.get("due_date") or "",
                "local_mode": payload.get("local_mode") or "no-llm",
                "ai_profile_id": payload.get("ai_profile_id") or "",
                "access_key": teacher_access_key,
            },
        )
        classroom["security_bootstrap"] = security_bootstrap
        assignment = classroom["assignments"][-1]
        generated = self.generate_control_plane(
            {
                "school_name": payload["school_name"],
                "classroom_title": classroom["title"],
                "teacher_name": classroom["teacher_name"],
                "subject": classroom["subject"],
                "grade_band": classroom["grade_band"],
                "classroom_id": classroom_id,
                "assignment_id": assignment["assignment_id"],
                "assignment_title": assignment["title"],
                "template_id": assignment["template_id"],
            }
        )
        return {
            "classroom": classroom,
            "assignment": assignment,
            "control_plane": generated["config"],
            "control_plane_path": generated["path"],
            "attestation_path": generated["attestation_path"],
            "source_summary": self.get_source_summary(),
        }

    def generate_control_plane(self, payload: dict[str, Any]) -> dict[str, Any]:
        source = self.get_source_summary()
        safe_channels = self._derive_safe_channels(source.get("channels", []))
        slug = self._slugify(f"{payload['school_name']}-{payload['classroom_title']}")
        target_dir = self.output_root / slug
        target_dir.mkdir(parents=True, exist_ok=True)
        config = {
            "version": "1.0",
            "product": {
                "name": "EduClawn",
                "source_shape": "OpenClaw",
                "source_import_path": source.get("path", ""),
                "license_reference": source.get("license", ""),
            },
            "school": {
                "name": payload["school_name"],
                "classroom_title": payload["classroom_title"],
                "teacher_name": payload["teacher_name"],
                "subject": payload["subject"],
                "grade_band": payload["grade_band"],
                "classroom_id": payload["classroom_id"],
                "assignment_id": payload["assignment_id"],
            },
            "gateway": {
                "mode": "local-first",
                "bind": "127.0.0.1",
                "pairing_policy": "required",
                "session_isolation": "classroom-role-thread",
                "allowed_channels": safe_channels,
                "blocked_features": list(BLOCKED_OPENCLAW_FEATURES),
                "control_ui": {
                    "desktop": True,
                    "webchat": "local-only",
                    "teacher_dashboard": True,
                    "student_dashboard": True,
                },
            },
            "roles": {
                "teacher": {
                    "agents": ["lesson-planner", "rubric-designer", "feedback-coach", "classroom-analyst"],
                    "tools": ["classroom_read", "assignment_read", "teacher_feedback", "approval_queue", "audit_review"],
                },
                "student": {
                    "agents": ["project-coach", "research-coach", "citation-tutor", "revision-tutor", "study-planner"],
                    "tools": ["approved_evidence_search", "citation_map", "project_compile", "local_export"],
                },
                "shared": {
                    "agents": ["approval-guard", "audit-reporter", "evidence-librarian"],
                    "tools": ["approval_queue", "audit_review", "classroom_read"],
                },
            },
            "tools": {
                "allow": list(EDUCLAWN_TOOL_ALLOWLIST),
                "deny": sorted(set(EDUCLAWN_TOOL_DENYLIST + tuple(source.get("dangerous_tools", [])))),
                "approval_required_for": [
                    "external_messaging",
                    "browser_navigation",
                    "public_publish",
                    "shell",
                    "fs_delete",
                ],
            },
            "skills": {
                "source_count": source.get("counts", {}).get("skills", 0),
                "enabled_skill_packs": self._derive_safe_skill_packs(source.get("skills", [])),
            },
            "templates": {
                "primary_template_id": payload["template_id"],
                "registry": [
                    template["id"]
                    for template in self.template_registry.list_templates()
                    if template["category"] in {"education", "history", "research", "science", "literacy", "civics"}
                ],
            },
        }
        canonical = yaml.safe_dump(config, sort_keys=True)
        config_sha256 = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
        signature = hmac.new(self.security_secret, canonical.encode("utf-8"), hashlib.sha256).hexdigest()
        attestation_seed = f"{payload['classroom_id']}:{payload['assignment_id']}"
        config["security"] = {
            "attestation_id": f"att-{hashlib.sha256(attestation_seed.encode('utf-8')).hexdigest()[:16]}",
            "config_sha256": config_sha256,
            "signature": signature,
            "signature_algorithm": "hmac-sha256",
            "generated_at": datetime.now(UTC).isoformat(),
            "source_snapshot": {
                "path": source.get("path", ""),
                "version": source.get("version", ""),
                "dangerous_tools_count": len(source.get("dangerous_tools", [])),
            },
        }
        config_path = target_dir / "educlawn-control-plane.yaml"
        config_path.write_text(yaml.safe_dump(config, sort_keys=False), encoding="utf-8")
        attestation_path = target_dir / "educlawn-control-plane.attestation.json"
        attestation = {
            "config_path": str(config_path),
            "config_sha256": config_sha256,
            "signature": signature,
            "signature_algorithm": "hmac-sha256",
            "verified": self._verify_signature(canonical, signature),
        }
        attestation_path.write_text(json.dumps(attestation, indent=2), encoding="utf-8")
        summary_path = target_dir / "educlawn-source-summary.json"
        summary_path.write_text(json.dumps(source, indent=2), encoding="utf-8")
        return {
            "path": str(config_path),
            "attestation_path": str(attestation_path),
            "summary_path": str(summary_path),
            "config": config,
        }

    def _verify_signature(self, canonical: str, signature: str) -> bool:
        expected = hmac.new(self.security_secret, canonical.encode("utf-8"), hashlib.sha256).hexdigest()
        return hmac.compare_digest(signature, expected)

    def _derive_safe_channels(self, channels: list[str]) -> list[str]:
        selected = [channel for channel in SAFE_CHANNEL_PRIORITY if channel in channels]
        if "webchat" not in selected:
            selected.insert(0, "webchat")
        return selected[:6]

    def _derive_safe_skill_packs(self, skills: list[str]) -> list[str]:
        preferred = [
            "summarize",
            "canvas",
            "nano-pdf",
            "session-logs",
            "coding-agent",
            "skill-creator",
        ]
        selected = [skill for skill in preferred if skill in skills]
        return selected[:6]

    def _parse_node_requirement(self, path: Path) -> str:
        if not path.exists():
            return ""
        text = path.read_text(encoding="utf-8")
        major = re.search(r"MIN_NODE_MAJOR\s*=\s*(\d+)", text)
        minor = re.search(r"MIN_NODE_MINOR\s*=\s*(\d+)", text)
        if major and minor:
            return f">={major.group(1)}.{minor.group(1)}"
        return ""

    def _parse_dangerous_tools(self, path: Path) -> list[str]:
        if not path.exists():
            return []
        text = path.read_text(encoding="utf-8")
        names = re.findall(r'"([a-z0-9_:-]+)"', text)
        return sorted(set(names))

    def _load_json(self, path: Path) -> dict[str, Any]:
        if not path.exists():
            return {}
        return json.loads(path.read_text(encoding="utf-8"))

    def _slugify(self, value: str) -> str:
        normalized = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
        return normalized or f"educlawn-{datetime.now(UTC).strftime('%Y%m%d%H%M%S')}"
