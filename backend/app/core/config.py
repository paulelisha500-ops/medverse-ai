from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_INSECURE_KEYS = {"", "change-this-to-a-long-random-string"}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    APP_NAME: str = "MedVerse AI"

    # Security — no default on purpose: a published default key lets anyone forge tokens.
    SECRET_KEY: str = Field(default="", validate_default=True)

    @field_validator("SECRET_KEY")
    @classmethod
    def _require_real_secret(cls, v: str) -> str:
        if v.strip() in _INSECURE_KEYS or len(v) < 32:
            raise ValueError(
                "SECRET_KEY is missing or insecure. Set a random value of 32+ characters in "
                'backend/.env, e.g. python -c "import secrets; print(secrets.token_hex(32))"'
            )
        return v
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    # Database
    DATABASE_URL: str = "sqlite:///./data/medverse.db"

    # LLM provider
    LLM_PROVIDER: str = "none"  # openai | anthropic | ollama | none

    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"

    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_MODEL: str = "claude-sonnet-5"

    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.1"

    EMBEDDING_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"

    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3004"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
