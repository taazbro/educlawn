from __future__ import annotations

import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app


def _build_fake_openclaw_source(root: Path) -> None:
    (root / "docs" / "channels").mkdir(parents=True, exist_ok=True)
    (root / "skills").mkdir(parents=True, exist_ok=True)
    (root / "extensions").mkdir(parents=True, exist_ok=True)
    (root / "apps").mkdir(parents=True, exist_ok=True)
    (root / "src" / "security").mkdir(parents=True, exist_ok=True)

    (root / "package.json").write_text(
        json.dumps(
            {
                "name": "openclaw",
                "version": "2026.3.14",
                "license": "MIT",
            }
        ),
        encoding="utf-8",
    )
    (root / "openclaw.mjs").write_text(
        "const MIN_NODE_MAJOR = 22;\nconst MIN_NODE_MINOR = 12;\n",
        encoding="utf-8",
    )
    (root / "src" / "security" / "dangerous-tools.ts").write_text(
        'export const DANGEROUS_ACP_TOOL_NAMES = ["exec", "spawn", "gateway", "fs_delete"] as const;\n',
        encoding="utf-8",
    )
    for channel in ["webchat", "googlechat", "msteams", "whatsapp", "index"]:
        (root / "docs" / "channels" / f"{channel}.md").write_text(f"# {channel}\n", encoding="utf-8")
    for skill in ["summarize", "canvas", "nano-pdf", "voice-call"]:
        (root / "skills" / skill).mkdir(parents=True, exist_ok=True)
    for extension in ["slack", "discord", "phone-control"]:
        (root / "extensions" / extension).mkdir(parents=True, exist_ok=True)
    for app in ["macos", "android"]:
        (root / "apps" / app).mkdir(parents=True, exist_ok=True)


def test_educlaw_import_and_bootstrap(tmp_path):
    openclaw_root = tmp_path / "openclaw_source"
    _build_fake_openclaw_source(openclaw_root)
    settings = Settings(
        db_path=tmp_path / "educlaw.sqlite3",
        workflow_scheduler_enabled=False,
        admin_password="mlk-admin-demo",
        studio_root_dir=tmp_path / "studio_workspace",
        studio_template_dir=tmp_path / "templates",
        community_root_dir=tmp_path / "community",
        openclaw_root_dir=openclaw_root,
    )
    app = create_app(settings)

    with TestClient(app) as client:
        overview = client.get("/api/v1/educlaw/overview")
        assert overview.status_code == 200
        payload = overview.json()
        assert payload["product_name"] == "EduClaw"
        assert payload["source_summary"]["available"] is True
        assert payload["source_summary"]["package_name"] == "openclaw"
        assert payload["source_summary"]["node_requirement"] == ">=22.12"
        assert "webchat" in payload["derived_control_plane"]["allowed_channels"]
        assert "gateway" in payload["derived_control_plane"]["denied_tools"]
        assert payload["derived_control_plane"]["attestation"]["algorithm"] == "hmac-sha256"

        source = client.get("/api/v1/educlaw/source")
        assert source.status_code == 200
        source_payload = source.json()
        assert source_payload["counts"]["skills"] == 4
        assert source_payload["counts"]["channels"] == 4
        assert "canvas" in source_payload["skills"]

        bootstrap = client.post(
            "/api/v1/educlaw/bootstrap",
            json={
                "school_name": "Roosevelt High",
                "classroom_title": "Civics 2A",
                "teacher_name": "Ms. Rivera",
                "subject": "Civics",
                "grade_band": "Grades 9-10",
                "description": "EduClaw classroom bootstrap",
                "default_template_id": "lesson-module",
                "template_id": "research-portfolio",
                "assignment_title": "Community Archive Brief",
                "assignment_summary": "Create a cited classroom-safe project.",
                "topic": "Community archives and local history",
                "audience": "Grade 10 students",
                "goals": ["Use approved evidence", "Build a cited brief"],
                "rubric": ["Evidence Quality", "Citation Accuracy"],
                "standards_focus": ["Source Analysis", "Civic Inquiry"],
                "due_date": "2026-04-20",
                "local_mode": "no-llm",
            },
        )
        assert bootstrap.status_code == 201
        bootstrap_payload = bootstrap.json()
        assert bootstrap_payload["classroom"]["title"] == "Civics 2A"
        assert bootstrap_payload["assignment"]["title"] == "Community Archive Brief"
        assert bootstrap_payload["classroom"]["security_bootstrap"]["teacher_access_key"].startswith("tch-")
        assert bootstrap_payload["control_plane"]["gateway"]["pairing_policy"] == "required"
        assert "webchat" in bootstrap_payload["control_plane"]["gateway"]["allowed_channels"]
        assert bootstrap_payload["control_plane"]["security"]["signature_algorithm"] == "hmac-sha256"
        assert bootstrap_payload["control_plane_path"].endswith("educlaw-control-plane.yaml")
        assert bootstrap_payload["attestation_path"].endswith("educlaw-control-plane.attestation.json")
        assert Path(bootstrap_payload["control_plane_path"]).exists()
        assert Path(bootstrap_payload["attestation_path"]).exists()
