package com.neph.features.requesthelp.data

import com.neph.core.sync.LocalOwnerType
import com.neph.core.sync.SyncStatus
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RequestHelpOfflineMappingTest {
    @Test
    fun submissionCreatesPendingLocalEntityForOfflineWrite() {
        val submission = sampleSubmission()
        val entity = submission.toEntity(
            localId = "local-test",
            ownerType = LocalOwnerType.GUEST,
            now = 1234L,
            syncStatus = SyncStatus.PENDING_CREATE
        )

        assertEquals("local-test", entity.localId)
        assertEquals(LocalOwnerType.GUEST, entity.ownerType)
        assertEquals(SyncStatus.PENDING_CREATE, entity.syncStatus)
        assertEquals("PENDING_SYNC", entity.status)
        assertEquals("Need water and medication", entity.description)
        assertEquals(listOf("food_water", "first_aid"), entity.helpTypesJson.jsonArrayToStringList())
        assertFalse(entity.isDeleted)
    }

    @Test
    fun submissionJsonMatchesBackendContractForCreate() {
        val json = sampleSubmission().toJson()

        assertEquals(2, json.getJSONArray("helpTypes").length())
        assertEquals("food_water", json.getJSONArray("helpTypes").getString(0))
        assertEquals(3, json.getInt("affectedPeopleCount"))
        assertEquals("Kadikoy", json.getJSONObject("location").getString("district"))
        assertEquals(5551234567L, json.getJSONObject("contact").getLong("phone"))
        assertTrue(json.getBoolean("consentGiven"))
    }

    private fun sampleSubmission(): RequestHelpSubmission {
        return RequestHelpSubmission(
            helpTypes = listOf("food_water", "first_aid"),
            otherHelpText = "",
            affectedPeopleCount = 3,
            description = "Need water and medication",
            riskFlags = listOf("Flooding"),
            vulnerableGroups = listOf("Elderly"),
            bloodType = "A+",
            location = RequestHelpLocationSubmission(
                country = "Turkey",
                city = "Istanbul",
                district = "Kadikoy",
                neighborhood = "Moda",
                extraAddress = "Near park"
            ),
            contact = RequestHelpContactSubmission(
                fullName = "Ayse Yilmaz",
                phone = 5551234567L,
                alternativePhone = null
            ),
            consentGiven = true
        )
    }
}
