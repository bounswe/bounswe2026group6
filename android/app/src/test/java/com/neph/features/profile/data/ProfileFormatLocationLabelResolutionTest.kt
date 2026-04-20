package com.neph.features.profile.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ProfileFormatLocationLabelResolutionTest {
    @Test
    fun resolvesLocationLabelsFromSelectionKeys() {
        assertEquals("Turkey", resolveCountryLabel("tr"))
        assertEquals("Istanbul", resolveCityLabel("tr", "istanbul"))
        assertEquals("Kadıköy", resolveDistrictLabel("tr", "istanbul", "kadikoy"))
        assertEquals(
            "Bostancı",
            resolveNeighborhoodLabel("tr", "istanbul", "kadikoy", "bostanci")
        )
    }

    @Test
    fun keepsLocationLabelsWhenAlreadyProvidedAsLabels() {
        assertEquals("Turkey", resolveCountryLabel("Turkey"))
        assertEquals("Istanbul", resolveCityLabel("tr", "Istanbul"))
        assertEquals("Kadıköy", resolveDistrictLabel("tr", "istanbul", "Kadıköy"))
        assertEquals(
            "Bostancı",
            resolveNeighborhoodLabel("tr", "istanbul", "kadikoy", "Bostancı")
        )
    }

    @Test
    fun returnsNullWhenSelectionIsBlank() {
        assertNull(resolveCountryLabel(""))
        assertNull(resolveCityLabel("tr", ""))
        assertNull(resolveDistrictLabel("tr", "istanbul", ""))
        assertNull(resolveNeighborhoodLabel("tr", "istanbul", "kadikoy", ""))
    }
}
