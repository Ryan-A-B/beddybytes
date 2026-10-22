from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


class WebApp(Protocol):
    def create_account(self, email: str, password: str) -> None:
        ...

    def login(self, email: str, password: str) -> None:
        ...

    def get_license_info(self) -> LicenseInfo:
        ...

@dataclass
class LicenseInfo(Protocol):
    license_type: str
    start_unix_timestamp: int
    end_unix_timestamp: int
