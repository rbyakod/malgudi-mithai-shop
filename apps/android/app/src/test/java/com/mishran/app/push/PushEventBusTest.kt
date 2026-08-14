// apps/android/app/src/test/java/com/mishran/app/push/PushEventBusTest.kt — Task 11.3.
//
// JVM tests for the foreground push bus: subscribers see published events,
// and a publish with no subscriber is dropped, not buffered forever.
// NOTE: source-complete (no SDK).
package com.mishran.app.push

import kotlinx.coroutines.async
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.yield
import org.junit.Assert.assertEquals
import org.junit.Test

class PushEventBusTest {

    private val event = OrderPushEvent("order-1", "packed", "evt-1")

    @Test
    fun `subscribers receive published events`() = runTest {
        val bus = PushEventBus()
        val received = async { bus.events.first() }
        yield() // let the collector subscribe before publishing

        bus.publish(event)

        assertEquals(event, received.await())
    }

    @Test
    fun `multiple subscribers each receive the event`() = runTest {
        val bus = PushEventBus()
        val first = async { bus.events.first() }
        val second = async { bus.events.first() }
        yield() // both subscribed before the publish

        bus.publish(event)

        assertEquals(event, first.await())
        assertEquals(event, second.await())
    }

    @Test
    fun `late subscriber does not replay an already-published event`() = runTest {
        val bus = PushEventBus()
        bus.publish(event) // no subscriber yet

        var received: OrderPushEvent? = null
        val job = launch { received = bus.events.first() }
        yield() // collector starts; a replayed event would land before this returns

        assertEquals(null, received)
        job.cancel()
    }
}
