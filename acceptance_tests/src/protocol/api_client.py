from dataclasses import dataclass
from typing import Any, ContextManager, Protocol


@dataclass
class TokenOutput:
    access_token: str


class APIClient(Protocol):
    def get_token(self, email: str, password: str) -> TokenOutput:
        ...

    def get_account_info(self, access_token: str) -> dict[str, Any]:
        ...

    def list_sessions(self, access_token: str) -> Any:
        ...


class APIClientFactory(Protocol):
    def create(self) -> ContextManager[APIClient]:
        ...
