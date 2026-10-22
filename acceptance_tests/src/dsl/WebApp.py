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
class LicenseInfo:
    license_type: str
    start_unix_timestamp: int
    trial_detail: TrialDetail | None = None

@dataclass
class TrialDetail:
    end_unix_timestamp: int
