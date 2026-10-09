from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # A SQLite file. Production uses an absolute path on a persistent disk, e.g. sqlite:////var/data/app.db (four slashes).
    database_url: str = "sqlite:///./dev.db"
    # The only origin allowed to send non-GET requests (checked in app/main.py).
    frontend_origin: str = "http://localhost:3000"
    # Set true behind HTTPS so the session cookie is never sent over plain HTTP.
    cookie_secure: bool = False
    # Photo uploads by hosts (Cloudinary). Optional: without them the form falls back to pasted links.
    cloudinary_cloud_name: str = ""
    cloudinary_api_key: str = ""
    cloudinary_api_secret: str = ""


settings = Settings()
