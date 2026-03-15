from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


def _env_first(*names: str) -> str | None:
    for name in names:
        raw_value = os.getenv(name)
        if raw_value is not None:
            return raw_value
    return None


def _env_bool(default: bool, *names: str) -> bool:
    raw_value = _env_first(*names)
    if raw_value is None:
        return default
    return raw_value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(slots=True)
class Settings:
    app_name: str = "EduClawn"
    api_prefix: str = "/api/v1"
    root_dir: Path = field(default_factory=lambda: Path(__file__).resolve().parents[3])
    db_path: Path | None = None
    database_url: str | None = None
    legacy_html_path: Path | None = None
    studio_root_dir: Path | None = None
    studio_template_dir: Path | None = None
    community_root_dir: Path | None = None
    openclaw_root_dir: Path | None = None
    frontend_dist_dir: Path | None = None
    admin_username: str = "admin"
    admin_password: str = "mlk-admin-demo"
    auth_secret: str = "local-dev-educlawn-secret-change-me"
    auth_token_ttl_minutes: int = 120
    workflow_scheduler_enabled: bool = True
    etl_interval_seconds: int = 600
    retrain_interval_seconds: int = 1800
    benchmark_interval_seconds: int = 2400
    eager_model_training: bool = True
    model_cache_dir: Path | None = None
    local_llm_model: str = ""
    local_llm_base_url: str = "http://127.0.0.1:11434"
    educlawn_security_secret: str = "educlawn-local-security-secret-change-me"
    edu_material_max_bytes: int = 5_000_000
    allowed_origins: tuple[str, ...] = (
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:4173",
        "http://localhost:4173",
    )

    def __post_init__(self) -> None:
        db_path_override = _env_first("EDUCLAWN_DB_PATH", "MLK_DB_PATH")
        db_url_override = _env_first("EDUCLAWN_DATABASE_URL", "MLK_DATABASE_URL")
        legacy_override = _env_first("EDUCLAWN_LEGACY_HTML_PATH", "MLK_LEGACY_HTML_PATH")
        studio_override = _env_first("EDUCLAWN_STUDIO_ROOT", "MLK_STUDIO_ROOT")
        template_override = _env_first("EDUCLAWN_STUDIO_TEMPLATE_DIR", "MLK_STUDIO_TEMPLATE_DIR")
        community_override = _env_first("EDUCLAWN_COMMUNITY_ROOT", "MLK_COMMUNITY_ROOT")
        openclaw_override = _env_first("EDUCLAWN_OPENCLAW_ROOT", "MLK_OPENCLAW_ROOT")
        frontend_dist_override = _env_first("EDUCLAWN_FRONTEND_DIST_DIR", "MLK_FRONTEND_DIST_DIR")
        model_cache_override = _env_first("EDUCLAWN_MODEL_CACHE_DIR", "MLK_MODEL_CACHE_DIR")
        material_bytes_override = _env_first("EDUCLAWN_EDU_MATERIAL_MAX_BYTES", "MLK_EDU_MATERIAL_MAX_BYTES")

        self.admin_username = _env_first("EDUCLAWN_ADMIN_USERNAME", "MLK_ADMIN_USERNAME") or self.admin_username
        self.admin_password = _env_first("EDUCLAWN_ADMIN_PASSWORD", "MLK_ADMIN_PASSWORD") or self.admin_password
        self.auth_secret = _env_first("EDUCLAWN_AUTH_SECRET", "MLK_AUTH_SECRET") or self.auth_secret
        self.educlawn_security_secret = (
            _env_first("EDUCLAWN_SECURITY_SECRET", "MLK_EDUCLAW_SECURITY_SECRET") or self.educlawn_security_secret
        )
        self.auth_token_ttl_minutes = int(
            _env_first("EDUCLAWN_AUTH_TOKEN_TTL_MINUTES", "MLK_AUTH_TOKEN_TTL_MINUTES")
            or str(self.auth_token_ttl_minutes)
        )
        self.workflow_scheduler_enabled = _env_bool(
            self.workflow_scheduler_enabled,
            "EDUCLAWN_WORKFLOW_SCHEDULER_ENABLED",
            "MLK_WORKFLOW_SCHEDULER_ENABLED",
        )
        self.etl_interval_seconds = int(
            _env_first("EDUCLAWN_ETL_INTERVAL_SECONDS", "MLK_ETL_INTERVAL_SECONDS")
            or str(self.etl_interval_seconds)
        )
        self.retrain_interval_seconds = int(
            _env_first("EDUCLAWN_RETRAIN_INTERVAL_SECONDS", "MLK_RETRAIN_INTERVAL_SECONDS")
            or str(self.retrain_interval_seconds)
        )
        self.benchmark_interval_seconds = int(
            _env_first("EDUCLAWN_BENCHMARK_INTERVAL_SECONDS", "MLK_BENCHMARK_INTERVAL_SECONDS")
            or str(self.benchmark_interval_seconds)
        )
        self.eager_model_training = _env_bool(
            self.eager_model_training,
            "EDUCLAWN_EAGER_MODEL_TRAINING",
            "MLK_EAGER_MODEL_TRAINING",
        )
        self.local_llm_model = _env_first("EDUCLAWN_LOCAL_LLM_MODEL", "MLK_LOCAL_LLM_MODEL") or self.local_llm_model
        self.local_llm_base_url = (
            _env_first("EDUCLAWN_LOCAL_LLM_BASE_URL", "MLK_LOCAL_LLM_BASE_URL") or self.local_llm_base_url
        )
        if material_bytes_override:
            self.edu_material_max_bytes = int(material_bytes_override)

        if self.db_path is None:
            default_db_path = self.root_dir / "backend" / "data_artifacts" / "educlawn.sqlite3"
            legacy_db_path = self.root_dir / "backend" / "data_artifacts" / "mlk_intelligence.sqlite3"
            self.db_path = legacy_db_path if legacy_db_path.exists() and not default_db_path.exists() else default_db_path
        if self.legacy_html_path is None:
            self.legacy_html_path = self.root_dir / "Legacy_of_Justice.html"
        if self.studio_root_dir is None:
            self.studio_root_dir = self.root_dir / "studio_workspace"
        if self.studio_template_dir is None:
            self.studio_template_dir = self.root_dir / "studio" / "templates"
        if self.community_root_dir is None:
            self.community_root_dir = self.root_dir / "community"
        if self.openclaw_root_dir is None:
            self.openclaw_root_dir = self.root_dir.parent / "openclaw"
        if self.frontend_dist_dir is None:
            self.frontend_dist_dir = self.root_dir / "frontend" / "dist"
        if self.model_cache_dir is None:
            self.model_cache_dir = self.root_dir / "backend" / "data_artifacts" / "model_cache"

        if db_path_override:
            self.db_path = Path(db_path_override)
        if legacy_override:
            self.legacy_html_path = Path(legacy_override)
        if studio_override:
            self.studio_root_dir = Path(studio_override)
        if template_override:
            self.studio_template_dir = Path(template_override)
        if community_override:
            self.community_root_dir = Path(community_override)
        if openclaw_override:
            self.openclaw_root_dir = Path(openclaw_override)
        if frontend_dist_override:
            self.frontend_dist_dir = Path(frontend_dist_override)
        if model_cache_override:
            self.model_cache_dir = Path(model_cache_override)

        if db_url_override:
            self.database_url = db_url_override
        elif self.database_url is None:
            self.database_url = f"sqlite:///{self.db_path.resolve()}"

        if self.database_url.startswith("sqlite:///"):
            sqlite_path = Path(self.database_url.replace("sqlite:///", "", 1))
            sqlite_path.parent.mkdir(parents=True, exist_ok=True)

        self.studio_root_dir.mkdir(parents=True, exist_ok=True)
        self.studio_template_dir.mkdir(parents=True, exist_ok=True)
        self.community_root_dir.mkdir(parents=True, exist_ok=True)
        self.model_cache_dir.mkdir(parents=True, exist_ok=True)

    @property
    def database_backend(self) -> str:
        if self.database_url.startswith("postgresql"):
            return "postgresql"
        if self.database_url.startswith("sqlite"):
            return "sqlite"
        return "unknown"
