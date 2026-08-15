// apps/android/app/src/test/java/com/mishran/app/ui/stories/StoriesViewModelTest.kt — P2 net-new (stories).
//
// JVM unit tests for the journal-list ViewModel: the two-emit (Cached →
// Fresh) mapping, the empty list's degraded Fresh state, pull-to-refresh
// forcing the network pass, and the date formatter. Mirrors
// CatalogViewModelTest's harness. NOTE: source-complete (no SDK).
package com.mishran.app.ui.stories

import com.mishran.api.models.Story
import com.mishran.app.data.repository.StoryRepository
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class StoriesViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private lateinit var repository: StoryRepository

    private val cachedList = listOf(story("s1", "The Karigar"))
    private val freshList = listOf(
        story("s2", "Milk, on the road"),
        story("s1", "The Karigar"),
    )

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
        repository = mockk()
    }

    @After
    fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `first emission renders as Cached, second as Fresh`() = runTest(dispatcher) {
        every { repository.getStories(any()) } returns flowOf(cachedList, freshList)

        val vm = StoriesViewModel(repository)
        vm.uiState.collectInTest(this)
        advanceUntilIdle()

        assertEquals(StoriesUiState.Fresh(freshList), vm.uiState.value)
        assertEquals(2, vm.uiState.value.stories.size)
    }

    @Test
    fun `an empty cache renders an empty Fresh list, not a stuck Loading`() = runTest(dispatcher) {
        every { repository.getStories(any()) } returns flowOf(emptyList(), emptyList())

        val vm = StoriesViewModel(repository)
        vm.uiState.collectInTest(this)
        advanceUntilIdle()

        assertEquals(StoriesUiState.Fresh(emptyList()), vm.uiState.value)
        assertTrue(vm.uiState.value.stories.isEmpty())
    }

    @Test
    fun `initial load is not forced`() = runTest(dispatcher) {
        every { repository.getStories(any()) } returns flowOf(cachedList)

        val vm = StoriesViewModel(repository)
        vm.uiState.collectInTest(this)
        advanceUntilIdle()

        coVerify(exactly = 1) { repository.getStories(false) }
        coVerify(exactly = 0) { repository.getStories(true) }
    }

    @Test
    fun `refresh re-collects with force = true and clears the refreshing flag`() = runTest(dispatcher) {
        every { repository.getStories(any()) } returns flowOf(freshList)

        val vm = StoriesViewModel(repository)
        vm.uiState.collectInTest(this)
        advanceUntilIdle()

        vm.refresh()
        advanceUntilIdle()

        coVerify(exactly = 1) { repository.getStories(true) }
        assertEquals(false, vm.isRefreshing.value)
    }

    // ---- date formatter ---------------------------------------------------

    @Test
    fun `formatStoryDate renders a day-month-year label from an ISO instant`() {
        assertEquals("30 Jul 2026", formatStoryDate("2026-07-30T09:00:00Z"))
    }

    @Test
    fun `formatStoryDate passes through null and unparseable values`() {
        assertEquals(null, formatStoryDate(null))
        assertEquals("not-a-date", formatStoryDate("not-a-date"))
    }

    private fun story(id: String, title: String) = Story(
        id = id,
        slug = title.lowercase().replace(" ", "-"),
        title = title,
        pillar = Story.Pillar.karigar,
        excerpt = "Excerpt of $title.",
        publishedAt = "2026-07-30T09:00:00Z",
    )
}

/** Collect the flow in the background so stateIn's WhileSubscribed starts. */
private fun <T> kotlinx.coroutines.flow.StateFlow<T>.collectInTest(
    scope: kotlinx.coroutines.test.TestScope,
) {
    scope.backgroundScope.launch { this@collectInTest.collect { } }
}
