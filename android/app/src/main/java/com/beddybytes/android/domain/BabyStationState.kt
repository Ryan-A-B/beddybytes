package com.beddybytes.android.domain

sealed interface BabyStationState {
    data object SignedOut : BabyStationState

    data object Ready : BabyStationState

    data object Starting : BabyStationState

    data object Active : BabyStationState

    data object Reconnecting : BabyStationState

    data object Stopping : BabyStationState

    data class Failed(val message: String) : BabyStationState
}

sealed interface BabyStationEvent {
    data object SignedIn : BabyStationEvent

    data object SignedOut : BabyStationEvent

    data object StartRequested : BabyStationEvent

    data object Started : BabyStationEvent

    data object ConnectionLost : BabyStationEvent

    data object Reconnected : BabyStationEvent

    data object StopRequested : BabyStationEvent

    data object Stopped : BabyStationEvent

    data class Failed(val message: String) : BabyStationEvent
}
