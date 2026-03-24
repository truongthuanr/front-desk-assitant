from __future__ import annotations

import os


class Settings:
    def __init__(self) -> None:
        self.database_url = os.getenv(
            "DATABASE_URL", "postgresql://postgres:postgres@postgres:5432/frontdesk"
        )
        self.redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
        self.api_prefix = "/api/v1"
        self.general_queue_code = "GENERAL"
        self.general_queue_name = "General Intake Queue"

    @property
    def sqlalchemy_database_url(self) -> str:
        if self.database_url.startswith("postgresql+psycopg://"):
            return self.database_url
        return self.database_url.replace("postgresql://", "postgresql+psycopg://", 1)


settings = Settings()
