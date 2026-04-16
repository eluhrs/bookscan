from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    database_url: str
    secret_key: str
    app_username: str
    password_hash: str
    access_token_expire_minutes: int = 60 * 12  # 12 hours
    gemini_api_key: str | None = None
    ebay_shipping_profile: str = ""
    ebay_shipping_profile_alt: str = ""
    ebay_return_policy: str = ""
    ebay_payment_profile: str = ""
    ebay_shipping_location: str = ""
    photo_signing_secret: str = ""
    site_url: str = "https://bookscan.luhrs.net"


settings = Settings()
