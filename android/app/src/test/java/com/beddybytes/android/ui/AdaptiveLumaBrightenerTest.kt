package com.beddybytes.android.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AdaptiveLumaBrightenerTest {
    @Test
    fun `dark stack receives capped lift while preserving zero`() {
        val source = byteArrayOf(0, 0, 8, 8, 8, 8, 200.toByte())
        val destination = ByteArray(source.size)

        val gain = AdaptiveLumaBrightener().apply(source, destination)

        assertEquals(4f, gain)
        assertEquals(0, destination[0].unsigned())
        assertEquals(32, destination[2].unsigned())
        assertEquals(235, destination.last().unsigned())
    }

    @Test
    fun `moderately dark stack is lifted toward target luma`() {
        val source = ByteArray(10) { 48 }
        val destination = ByteArray(source.size)

        val gain = AdaptiveLumaBrightener().apply(source, destination)

        assertEquals(2f, gain)
        assertEquals(96, destination.first().unsigned())
    }

    @Test
    fun `captured S22 luma below sixteen is not mistaken for black`() {
        val source = byteArrayOf(3, 5, 5, 6, 11)
        val destination = ByteArray(source.size)

        val gain = AdaptiveLumaBrightener().apply(source, destination)

        assertEquals(4f, gain)
        assertEquals(listOf(12, 20, 20, 24, 44), destination.map { it.unsigned() })
    }

    @Test
    fun `already bright stack is not darkened`() {
        val source = ByteArray(10) { 128.toByte() }
        val destination = ByteArray(source.size)

        val gain = AdaptiveLumaBrightener().apply(source, destination)

        assertEquals(1f, gain)
        assertTrue(destination.all { it.unsigned() == 128 })
    }

    private fun Byte.unsigned(): Int = toInt() and 0xff
}
