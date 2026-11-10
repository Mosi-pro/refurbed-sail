"""Application configuration, loaded from environment variables / .env."""
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(ROOT_DIR / ".env"), env_prefix="RS_", extra="ignore")

    env: str = "development"  # development | production
    secret_key: str = ""
    database_url: str = f"sqlite:///{ROOT_DIR / 'data' / 'refurbed_sail.db'}"
    upload_dir: Path = ROOT_DIR / "uploads"
    log_dir: Path = ROOT_DIR / "logs"

    session_days: int = 14
    cookie_secure: bool | None = None  # default: True in production
    allowed_origins: str = ""  # comma separated, extra origins for CORS/Origin check

    listing_approval_required: bool = True
    max_image_mb: int = 10
    max_document_mb: int = 15
    max_images_per_boat: int = 24
    max_documents_per_boat: int = 30

    rate_limit_enabled: bool = True
    public_base_url: str = "http://localhost:5173"

    @property
    def is_production(self) -> bool:
        return self.env == "production"

    @property
    def secure_cookies(self) -> bool:
        return self.is_production if self.cookie_secure is None else self.cookie_secure

    @property
    def public_upload_dir(self) -> Path:
        return self.upload_dir / "public"

    @property
    def private_upload_dir(self) -> Path:
        return self.upload_dir / "private"


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    if not s.secret_key:
        if s.is_production:
            raise RuntimeError("RS_SECRET_KEY must be set in production.")
        s.secret_key = "dev-only-insecure-key"
    for d in (s.public_upload_dir, s.private_upload_dir, s.log_dir):
        d.mkdir(parents=True, exist_ok=True)
    return s
