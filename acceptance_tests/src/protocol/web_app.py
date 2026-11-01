from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, ContextManager


class WebApp(Protocol):
    def create_account(self, email: str, password: str) -> None:
        ...

    def login(self, email: str, password: str) -> None:
        ...

    def get_license_info(self) -> LicenseInfo:
        """Read license details from an already-open account screen."""
        ...

    def open_account_screen(self) -> None:
        ...

    def open_checkout(self) -> None:
        ...

    def pay(self) -> None:
        ...

    def get_current_screen(self) -> str:
        ...

    def trial_expired_banner_is_displayed(self) -> bool:
        ...

    def open_baby_station(self) -> None:
        ...

    def stop_baby_station_session(self) -> None:
        ...

    def baby_station_start_disabled(self) -> bool:
        ...

    def start_baby_station(self) -> None:
        ...

    def approve_baby_station_media_access(self) -> None:
        ...

    def get_baby_station_camera_list(self) -> list[str]:
        ...

    def pick_baby_station_camera(self, camera_name: str) -> None:
        ...

    def baby_station_active(self) -> bool:
        ...

    def start_parent_station(self) -> None:
        ...

    def wait_for_parent_station_to_connect(self) -> None:
        ...

    def session_active_in_parent_station(self) -> bool:
        ...

class WebAppFactory(Protocol):
    def create(self) -> ContextManager[WebApp]:
        ...

@dataclass
class LicenseInfo:
    license_type: str
    start_unix_timestamp: int
    trial_detail: TrialDetail | None = None

@dataclass
class TrialDetail:
    end_unix_timestamp: int
