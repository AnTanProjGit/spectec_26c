import secrets
from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "SpecialTech AI ERP API"
    app_version: str = "1.5.0"
    app_env: str = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8000

    # PostgreSQL 15+/17+ async connection string
    database_url: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/specialtech_erp"
    )
    sql_echo: bool = False

    # Ephemeral random fallback in dev if JWT_SECRET_KEY is unset in environment
    jwt_secret_key: str = Field(default_factory=lambda: secrets.token_urlsafe(32))
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 7

    cors_origins: List[str] = Field(
        default_factory=lambda: ["http://localhost:3000", "http://localhost:5173"]
    )

    gemini_api_key: str = ""
    glonass_api_token: str = ""
    onec_api_secret: str = ""

    upload_dir: str = "./uploads"

    @property
    def upload_path(self) -> Path:
        path = Path(self.upload_dir).resolve()
        path.mkdir(parents=True, exist_ok=True)
        return path


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    if not settings.jwt_secret_key:
        settings.jwt_secret_key = secrets.token_urlsafe(32)
    return settings
