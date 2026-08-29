package com.beddybytes.android.domain

class BabyStationStateMachine(initialState: BabyStationState = BabyStationState.SignedOut) {
    var state: BabyStationState = initialState
        private set

    fun dispatch(event: BabyStationEvent): BabyStationState {
        state = reduce(state, event)
        return state
    }

    companion object {
        fun reduce(state: BabyStationState, event: BabyStationEvent): BabyStationState =
            when (event) {
                BabyStationEvent.SignedOut -> BabyStationState.SignedOut

                is BabyStationEvent.Failed -> BabyStationState.Failed(event.message)

                BabyStationEvent.SignedIn -> requireState(state is BabyStationState.SignedOut) {
                    BabyStationState.Ready
                }

                BabyStationEvent.StartRequested -> requireState(state is BabyStationState.Ready) {
                    BabyStationState.Starting
                }

                BabyStationEvent.Started -> requireState(state is BabyStationState.Starting) {
                    BabyStationState.Active
                }

                BabyStationEvent.ConnectionLost -> requireState(state is BabyStationState.Active) {
                    BabyStationState.Reconnecting
                }

                BabyStationEvent.Reconnected -> requireState(
                    state is BabyStationState.Reconnecting,
                ) {
                    BabyStationState.Active
                }

                BabyStationEvent.StopRequested ->
                    requireState(
                        state is BabyStationState.Starting ||
                            state is BabyStationState.Active ||
                            state is BabyStationState.Reconnecting,
                    ) { BabyStationState.Stopping }

                BabyStationEvent.Stopped -> requireState(state is BabyStationState.Stopping) {
                    BabyStationState.Ready
                }
            }

        private inline fun requireState(
            condition: Boolean,
            nextState: () -> BabyStationState,
        ): BabyStationState {
            check(condition) { "Invalid Baby Station state transition" }
            return nextState()
        }
    }
}
