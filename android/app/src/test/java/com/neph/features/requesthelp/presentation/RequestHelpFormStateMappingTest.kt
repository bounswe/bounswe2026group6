package com.neph.features.requesthelp.presentation

import com.neph.core.database.HelpRequestEntity
import com.neph.core.sync.LocalOwnerType
import com.neph.core.sync.SyncStatus
import com.neph.features.profile.data.locationData
import org.json.JSONArray
import org.junit.Assert.assertEquals
import org.junit.Test

class RequestHelpFormStateMappingTest {
    @Test
    fun editFormHydratesPersistedLabelsIntoSelectableFormValues() {
        val formState = helpRequestEntity(
            helpTypes = listOf("search_rescue", "Food & Water"),
            riskFlags = listOf("gas_leak", "Blocked Access / Debris"),
            vulnerableGroups = listOf("elderly", "Chronic Condition"),
            country = "Turkey",
            city = "Istanbul",
            district = "Kadıköy",
            neighborhood = "Bostancı",
            contactPhone = "905551112233",
            contactAlternativePhone = "+905551112244"
        ).toFormState(locationData)

        assertEquals(listOf("Search & Rescue", "Food & Water"), formState.helpTypes)
        assertEquals(listOf("Gas Leak", "Blocked Access / Debris"), formState.riskFlags)
        assertEquals(listOf("Elderly", "Chronic Condition"), formState.vulnerableGroups)
        assertEquals("tr", formState.country)
        assertEquals("istanbul", formState.city)
        assertEquals("kadikoy", formState.district)
        assertEquals("bostanci", formState.neighborhood)
        assertEquals("+90", formState.countryCode)
        assertEquals("5551112233", formState.phoneNumber)
        assertEquals("5551112244", formState.alternativePhone)
        assertEquals(true, formState.confirmationAccepted)
    }

    @Test
    fun editFormPreservesUnknownRemoteLocationValuesInsteadOfBlankingThem() {
        val formState = helpRequestEntity(
            country = "Atlantis",
            city = "Poseidon",
            district = "Coral",
            neighborhood = "Reef"
        ).toFormState(locationData)

        assertEquals("Atlantis", formState.country)
        assertEquals("Poseidon", formState.city)
        assertEquals("Coral", formState.district)
        assertEquals("Reef", formState.neighborhood)
    }

    private fun helpRequestEntity(
        helpTypes: List<String> = listOf("first_aid"),
        riskFlags: List<String> = emptyList(),
        vulnerableGroups: List<String> = emptyList(),
        country: String = "Turkey",
        city: String = "Istanbul",
        district: String = "Kadıköy",
        neighborhood: String = "Bostancı",
        contactPhone: String = "5551112233",
        contactAlternativePhone: String? = null
    ): HelpRequestEntity {
        return HelpRequestEntity(
            localId = "local-edit-test",
            remoteId = "remote-edit-test",
            ownerType = LocalOwnerType.AUTHENTICATED,
            guestAccessToken = null,
            helpTypesJson = JSONArray(helpTypes).toString(),
            otherHelpText = "",
            affectedPeopleCount = 2,
            riskFlagsJson = JSONArray(riskFlags).toString(),
            vulnerableGroupsJson = JSONArray(vulnerableGroups).toString(),
            description = "Need help after structural damage.",
            bloodType = "",
            shareProfileHealthInfoWithVolunteer = true,
            country = country,
            city = city,
            district = district,
            neighborhood = neighborhood,
            extraAddress = "Existing Street 5",
            contactFullName = "Alex Helper",
            contactPhone = contactPhone,
            contactAlternativePhone = contactAlternativePhone,
            status = "PENDING_SYNC",
            helperFirstName = null,
            helperLastName = null,
            helperPhone = null,
            helperProfession = null,
            helperExpertise = null,
            helpersJson = JSONArray().toString(),
            syncStatus = SyncStatus.PENDING_UPDATE,
            createdAtEpochMillis = 1_700_000_000_000L,
            updatedAtEpochMillis = 1_700_000_000_000L
        )
    }
}
