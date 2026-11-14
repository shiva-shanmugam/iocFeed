from abc import ABC, abstractmethod
from typing import Any
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential
from app.schemas import IndicatorIn

class FeedAdapter(ABC):
    name: str; url: str
    def __init__(self, auth_key: str): self.auth_key = auth_key
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=8), reraise=True)
    def fetch(self) -> Any:
        headers = {"Auth-Key": self.auth_key}
        response = httpx.post(self.url, headers=headers, data=self.payload(), timeout=30)
        response.raise_for_status(); return response.json() if "json" in response.headers.get("content-type", "") else response.text
    def payload(self) -> dict[str, str]: return {}
    @abstractmethod
    def parse(self, payload: Any) -> list[dict[str, Any]]: ...
    @abstractmethod
    def normalize(self, record: dict[str, Any]) -> IndicatorIn: ...
    def collect(self) -> list[IndicatorIn]:
        result=[]
        for row in self.parse(self.fetch()):
            try: result.append(self.normalize(row))
            except (ValueError, TypeError): continue
        return result

