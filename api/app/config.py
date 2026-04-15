from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    database_url: str
    secret_key: str
    app_username: str
    password_hash: str
    access_token_expire_minutes: int = 60 * 24 * 7  # 1 week
    gemini_api_key: str | None = None


settings = Settings()
