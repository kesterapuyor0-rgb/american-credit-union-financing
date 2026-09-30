from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="", case_sensitive=False)

    ai_worker_api_key: str = ""
    inference_timeout_seconds: float = 60.0
    max_concurrent_inference_jobs: int = 2


settings = Settings()
