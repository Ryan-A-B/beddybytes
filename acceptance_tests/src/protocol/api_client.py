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

    def start_payment(self, access_token: str) -> str:
        """Start checkout and return its URL without following the redirect."""
        ...

    def list_clients(self, access_token: str) -> list[dict[str, Any]]:
        ...

    def open_websocket(self, access_token: str, client_id: str) -> None:
        """Verify a client WebSocket handshake, then close the socket."""
        ...

    def open_connection(self, access_token: str, client_id: str, connection_id: str) -> None:
        """Verify a signaling WebSocket handshake, then close the socket."""
        ...

    def list_sessions(self, access_token: str) -> Any:
        ...

    def start_session(self, access_token: str, session_id: str) -> None:
        ...

    def end_session(self, access_token: str, session_id: str) -> None:
        ...

    def get_events(self, access_token: str) -> str:
        """Read the first SSE frame, then close the stream."""
        ...

    def get_snapshot(self, access_token: str) -> Any:
        ...


class APIClientFactory(Protocol):
    def create(self) -> ContextManager[APIClient]:
        ...
