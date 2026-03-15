from __future__ import annotations

from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app


def test_ai_provider_profile_lifecycle(tmp_path, monkeypatch):
    settings = Settings(
        db_path=tmp_path / "ai.sqlite3",
        workflow_scheduler_enabled=False,
        admin_password="mlk-admin-demo",
        studio_root_dir=tmp_path / "studio_workspace",
        studio_template_dir=tmp_path / "templates",
        community_root_dir=tmp_path / "community",
    )
    app = create_app(settings)

    def fake_invoke_provider(**_: object) -> str:
        return "READY classroom-safe provider connection."

    with TestClient(app) as client:
        monkeypatch.setattr(app.state.ai_provider_service, "_invoke_provider", fake_invoke_provider)
        catalog = client.get("/api/v1/ai/catalog")
        assert catalog.status_code == 200
        catalog_payload = catalog.json()
        assert any(entry["provider_id"] == "openai" for entry in catalog_payload)
        assert any(entry["provider_id"] == "anthropic" for entry in catalog_payload)

        create = client.post(
            "/api/v1/ai/profiles",
            json={
                "label": "Teacher OpenAI",
                "provider_id": "openai",
                "auth_mode": "user-key",
                "api_key": "sk-test-provider-key",
                "default_model": "gpt-5-mini",
                "base_url": "",
                "capabilities": ["research", "assignments", "feedback"],
            },
        )
        assert create.status_code == 201
        profile = create.json()
        profile_id = profile["profile_id"]
        assert profile["api_key_hint"].startswith("sk-t")

        listed = client.get("/api/v1/ai/profiles")
        assert listed.status_code == 200
        assert listed.json()[0]["profile_id"] == profile_id

        updated = client.put(
            f"/api/v1/ai/profiles/{profile_id}",
            json={
                "label": "Managed OpenAI Seat",
                "auth_mode": "managed-subscription",
                "capabilities": ["research", "planning", "review"],
            },
        )
        assert updated.status_code == 200
        assert updated.json()["auth_mode"] == "managed-subscription"

        tested = client.post(f"/api/v1/ai/profiles/{profile_id}/test")
        assert tested.status_code == 200
        assert tested.json()["used"] is True
        assert "READY" in tested.json()["output_text"]

        usage = client.get("/api/v1/ai/usage")
        assert usage.status_code == 200
        usage_payload = usage.json()
        assert usage_payload[0]["profile_id"] == profile_id
        assert usage_payload[0]["success"] is True

        deleted = client.delete(f"/api/v1/ai/profiles/{profile_id}")
        assert deleted.status_code == 204

        listed_after_delete = client.get("/api/v1/ai/profiles")
        assert listed_after_delete.status_code == 200
        assert listed_after_delete.json() == []
