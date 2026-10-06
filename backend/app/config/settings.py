from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    openrouter_api_key: str | None = None
    openrouter_model: str = "openrouter/free"
    email_provider: str = "smtp"
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_from_email: str | None = None
    smtp_from_name: str = "Conversation Intelligence"
    app_base_url: str = "http://localhost:3000"

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": False,
    }


settings = Settings()
