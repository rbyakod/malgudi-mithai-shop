// apps/android/app/src/test/java/com/mishran/app/data/local/ConvertersTest.kt — Task 9.1.
//
// JVM unit tests for the List<String> TypeConverter (the only piece of the Room
// layer that runs without an Android/instrumented environment — Room @Query
// verification needs a device/emulator). NOTE: source-complete (no SDK).
package com.mishran.app.data.local

import org.junit.Assert.assertEquals
import org.junit.Test

class ConvertersTest {

    private val converters = Converters()

    @Test
    fun `empty list round-trips through empty string`() {
        val encoded = converters.fromStringList(emptyList())
        assertEquals("", encoded)
        assertEquals(emptyList<String>(), converters.toStringList(encoded))
    }

    @Test
    fun `single element round-trips`() {
        val list = listOf("eggless")
        assertEquals(list, converters.toStringList(converters.fromStringList(list)))
    }

    @Test
    fun `multiple dietary tags round-trip in order`() {
        val list = listOf("sugar-free", "eggless", "gluten-free")
        assertEquals(list, converters.toStringList(converters.fromStringList(list)))
    }

    @Test
    fun `image urls round-trip`() {
        val list = listOf(
            "https://cdn.mishran.in/kaju-katli.jpg",
            "https://cdn.mishran.in/gulab-jamun.jpg",
        )
        assertEquals(list, converters.toStringList(converters.fromStringList(list)))
    }
}
