package com.neph.e2e

import androidx.test.platform.app.InstrumentationRegistry
import com.neph.features.requesthelp.data.RequestHelpContactSubmission
import com.neph.features.requesthelp.data.RequestHelpLocationSubmission
import com.neph.features.requesthelp.data.RequestHelpRepository
import com.neph.features.requesthelp.data.RequestHelpSubmission
import com.neph.features.requesthelp.data.jsonArrayToStringList
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Rule
import org.junit.Test

class RequestHelpRepositoryAndroidTest {
    private val fakeBackend = FakeNephBackend()
    private val environmentRule = NephE2ETestEnvironmentRule(fakeBackend) { context, _ ->
        RequestHelpRepository.initialize(context)
    }

    @get:Rule
    val rule = environmentRule

    @Test
    fun updateHelpRequestPersistsEditedFieldsInLocalDatabase() = runBlocking {
        RequestHelpRepository.initialize(InstrumentationRegistry.getInstrumentation().targetContext)
        val created = RequestHelpRepository.createHelpRequest(
            token = "access-token-1",
            submission = sampleSubmission(
                helpTypes = listOf("search_rescue"),
                description = "Need rescue near the building.",
                district = "Kadıköy",
                phone = 5551112233L
            )
        )

        RequestHelpRepository.updateHelpRequest(
            token = "access-token-1",
            localId = created.requestId,
            submission = sampleSubmission(
                helpTypes = listOf("shelter"),
                description = "Need shelter after moving locations.",
                district = "Beşiktaş",
                phone = 5552223344L
            ),
            preserveExistingCoordinates = false
        )

        val edited = RequestHelpRepository.getLocalHelpRequest(created.requestId)
        assertNotNull(edited)
        requireNotNull(edited)
        assertEquals(listOf("shelter"), edited.helpTypesJson.jsonArrayToStringList())
        assertEquals("Need shelter after moving locations.", edited.description)
        assertEquals("Beşiktaş", edited.district)
        assertEquals("5552223344", edited.contactPhone)
    }

    private fun sampleSubmission(
        helpTypes: List<String>,
        description: String,
        district: String,
        phone: Long
    ): RequestHelpSubmission {
        return RequestHelpSubmission(
            helpTypes = helpTypes,
            otherHelpText = "",
            affectedPeopleCount = 2,
            description = description,
            riskFlags = listOf("Fire"),
            vulnerableGroups = emptyList(),
            shareProfileHealthInfoWithVolunteer = true,
            location = RequestHelpLocationSubmission(
                country = "Turkey",
                city = "Istanbul",
                district = district,
                neighborhood = "Bostancı",
                extraAddress = "Existing Street 5"
            ),
            contact = RequestHelpContactSubmission(
                fullName = "Alex Helper",
                phone = phone
            ),
            consentGiven = true
        )
    }
}
