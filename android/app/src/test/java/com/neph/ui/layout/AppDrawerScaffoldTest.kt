package com.neph.ui.layout

import com.neph.navigation.Routes
import org.junit.Assert.assertEquals
import org.junit.Test

class AppDrawerScaffoldTest {
    @Test
    fun sanitizeDrawerItemsRemovesNullEntriesAndPreservesOrder() {
        val sanitized = sanitizeDrawerItems(
            listOf(
                Routes.Home,
                null,
                Routes.News,
                null,
                Routes.MyHelpRequests
            )
        )

        assertEquals(
            listOf(
                Routes.Home,
                Routes.News,
                Routes.MyHelpRequests
            ),
            sanitized
        )
    }

    @Test
    fun sanitizeDrawerItemsKeepsExistingDrawerListUnchanged() {
        val sanitized = sanitizeDrawerItems(
            listOf(
                Routes.Home,
                Routes.News,
                Routes.MyHelpRequests
            )
        )

        assertEquals(
            listOf(
                Routes.Home.route,
                Routes.News.route,
                Routes.MyHelpRequests.route
            ),
            sanitized.map { it.route }
        )
    }
}
