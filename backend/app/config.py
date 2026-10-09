from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Local development uses a SQLite file. Production will point at Turso (see README).
    database_url: str = "sqlite:///./dev.db"
    # Needed only when database_url is a libsql:// (Turso) address. Never put it in the URL.
    turso_auth_token: str = ""
    # The only origin allowed to send non-GET requests (checked in app/main.py).
    frontend_origin: str = "http://localhost:3000"
    # Set true behind HTTPS so the session cookie is never sent over plain HTTP.
    cookie_secure: bool = False
    # Photo uploads by hosts (Cloudinary). Optional: without them the form falls back to pasted links.
    cloudinary_cloud_name: str = ""
    cloudinary_api_key: str = ""
    cloudinary_api_secret: str = ""


settings = Settings()
