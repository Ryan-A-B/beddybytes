package com.beddybytes.android.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class BabyStationStateMachineTest {
    @Test
    fun `happy path reaches active and returns to ready`() {
        val machine = BabyStationStateMachine()

        assertEquals(BabyStationState.Ready, machine.dispatch(BabyStationEvent.SignedIn))
        assertEquals(BabyStationState.Starting, machine.dispatch(BabyStationEvent.StartRequested))
        assertEquals(BabyStationState.Active, machine.dispatch(BabyStationEvent.Started))
        assertEquals(BabyStationState.Stopping, machine.dispatch(BabyStationEvent.StopRequested))
        assertEquals(BabyStationState.Ready, machine.dispatch(BabyStationEvent.Stopped))
    }

    @Test
    fun `active session can reconnect`() {
        val machine = BabyStationStateMachine(BabyStationState.Active)

        assertEquals(
            BabyStationState.Reconnecting,
            machine.dispatch(BabyStationEvent.ConnectionLost),
        )
        assertEquals(BabyStationState.Active, machine.dispatch(BabyStationEvent.Reconnected))
    }

    @Test
    fun `sign out is valid from every state`() {
        val states =
            listOf(
                BabyStationState.SignedOut,
                BabyStationState.Ready,
                BabyStationState.Starting,
                BabyStationState.Active,
                BabyStationState.Reconnecting,
                BabyStationState.Stopping,
                BabyStationState.Failed("test"),
            )

        states.forEach { state ->
            val machine = BabyStationStateMachine(state)
            assertEquals(BabyStationState.SignedOut, machine.dispatch(BabyStationEvent.SignedOut))
        }
    }

    @Test
    fun `invalid transitions fail instead of hiding lifecycle bugs`() {
        val machine = BabyStationStateMachine(BabyStationState.SignedOut)

        assertThrows(IllegalStateException::class.java) {
            machine.dispatch(BabyStationEvent.StartRequested)
        }
    }
}
