from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    openrouter_api_key: str | None = None
    openrouter_model: str = "openrouter/free"

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": False,
    }


settings = Settings()
