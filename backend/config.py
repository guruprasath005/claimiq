from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    # vllm endpoint — used for OCR, ICD matching, evaluation, and indexing
    openrouter_api_key: str = ""
    openai_api_key: str     = "none"
    openai_base_url: str    = "http://10.10.116.160:11632/v1"
    llm_model: str          = "gemma-4-12b-it"

    # Local vllm endpoint for indexing (same as above by default)
    index_model_url: str    = "http://10.10.116.160:11632/v1"
    index_model: str        = "gemma-4-12b-it"

    # Fallback when local Gemma is unreachable
    fallback_api_key: str = ""
    fallback_model: str   = "gpt-4o-mini"

    @property
    def llm_api_key(self) -> str:
        return self.openrouter_api_key or self.openai_api_key

    @property
    def fallback_enabled(self) -> bool:
        return bool(self.fallback_api_key and self.fallback_api_key != "your-openai-api-key-here")

    # Paths
    tree_index_dir: Path = Path(__file__).parent.parent / "indexer" / "tree_index"
    insurance_data_dir: Path = Path(__file__).parent.parent / "InsuranceData"

    # Database
    database_url: str = "postgresql://localhost:5432/stobaeus"

    # Service
    max_upload_mb: int       = 20
    cors_origins: list[str]  = ["http://localhost:3000", "http://localhost:5173"]

    class Config:
        env_file = ".env"


settings = Settings()
