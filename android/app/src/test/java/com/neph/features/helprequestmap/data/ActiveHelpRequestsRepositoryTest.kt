package com.neph.features.helprequestmap.data

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.Instant
import java.util.TimeZone

class ActiveHelpRequestsRepositoryTest {
    @Test
    fun parseActiveHelpRequestsResponse_mapsWaitingUnassignedRequestsAndHidesAssignedOnes() {
        val response = JSONObject()
            .put(
                "requests",
                JSONArray()
                    .put(
                        JSONObject()
                            .put("requestId", "req-first-aid")
                            .put("type", "first_aid")
                            .put("status", "PENDING")
                            .put("urgencyLevel", "HIGH")
                            .put("createdAt", "2026-05-01T10:15:00.000Z")
                            .put("assignmentState", "UNASSIGNED")
                            .put(
                                "location",
                                JSONObject()
                                    .put("latitude", 41.043)
                                    .put("longitude", 29.009)
                                    .put("city", "istanbul")
                                    .put("district", "besiktas")
                            )
                    )
                    .put(
                        JSONObject()
                            .put("requestId", "req-assigned")
                            .put("type", "search_rescue")
                            .put("status", "PENDING")
                            .put("urgencyLevel", "HIGH")
                            .put("createdAt", "2026-05-01T10:05:00.000Z")
                            .put("assignmentState", "ASSIGNED")
                            .put(
                                "location",
                                JSONObject()
                                    .put("latitude", 41.079)
                                    .put("longitude", 29.022)
                                    .put("city", "istanbul")
                                    .put("district", "sariyer")
                            )
                    )
                    .put(
                        JSONObject()
                            .put("requestId", "req-resolved")
                            .put("type", "shelter")
                            .put("status", "RESOLVED")
                            .put("urgencyLevel", "MEDIUM")
                            .put("createdAt", "2026-05-01T09:55:00.000Z")
                            .put("assignmentState", "UNASSIGNED")
                            .put(
                                "location",
                                JSONObject()
                                    .put("latitude", 41.0)
                                    .put("longitude", 29.0)
                                    .put("city", "istanbul")
                                    .put("district", "sisli")
                            )
                    )
            )
            .put("total", 3)
            .put("pagination", JSONObject().put("limit", 300).put("offset", 0))

        val parsed = ActiveHelpRequestsRepository.parseActiveHelpRequestsResponse(response)

        assertEquals(1, parsed.requests.size)
        assertEquals(2, parsed.skippedCount)
        assertEquals(3, parsed.total)
        assertEquals(300, parsed.limit)
        assertEquals("req-first-aid", parsed.requests.first().requestId)
        assertEquals(CrisisRequestType.FIRST_AID, parsed.requests.first().type)
        assertEquals("First Aid", parsed.requests.first().typeLabel)
        assertEquals("HIGH", parsed.requests.first().priorityLevel)
    }

    @Test
    fun parseActiveHelpRequestsResponse_skipsMalformedMapRowsAndCountsHiddenEntries() {
        val response = JSONObject()
            .put(
                "requests",
                JSONArray()
                    .put(
                        JSONObject()
                            .put("requestId", "req-valid")
                            .put("type", "shelter")
                            .put("status", "PENDING")
                            .put("urgencyLevel", "MEDIUM")
                            .put("createdAt", "2026-05-01T10:15:00.000Z")
                            .put("assignmentState", "UNASSIGNED")
                            .put(
                                "location",
                                JSONObject()
                                    .put("latitude", 41.066)
                                    .put("longitude", 28.993)
                                    .put("city", "istanbul")
                                    .put("district", "sisli")
                            )
                    )
                    .put(
                        JSONObject()
                            .put("requestId", "req-missing-location")
                            .put("type", "first_aid")
                            .put("status", "PENDING")
                            .put("urgencyLevel", "HIGH")
                            .put("assignmentState", "UNASSIGNED")
                    )
                    .put(
                        JSONObject()
                            .put("requestId", "req-invalid-latitude")
                            .put("type", "first_aid")
                            .put("status", "PENDING")
                            .put("urgencyLevel", "HIGH")
                            .put("assignmentState", "UNASSIGNED")
                            .put(
                                "location",
                                JSONObject()
                                    .put("latitude", 141.0)
                                    .put("longitude", 29.009)
                                    .put("city", "istanbul")
                                    .put("district", "besiktas")
                            )
                    )
                    .put(
                        JSONObject()
                            .put("type", "food_water")
                            .put("status", "PENDING")
                            .put("urgencyLevel", "LOW")
                            .put("assignmentState", "UNASSIGNED")
                            .put(
                                "location",
                                JSONObject()
                                    .put("latitude", 41.043)
                                    .put("longitude", 29.009)
                                    .put("city", "istanbul")
                                    .put("district", "besiktas")
                            )
                    )
            )
            .put("total", 4)
            .put("pagination", JSONObject().put("limit", 300).put("offset", 0))

        val parsed = ActiveHelpRequestsRepository.parseActiveHelpRequestsResponse(response)

        assertEquals(1, parsed.requests.size)
        assertEquals(3, parsed.skippedCount)
        assertEquals("req-valid", parsed.requests.first().requestId)
        assertEquals("Shelter", parsed.requests.first().typeLabel)
    }

    @Test
    fun parseActiveHelpRequestsResponse_handlesBackendCaseVariantsAndMissingPaginationDefaults() {
        val response = JSONObject()
            .put(
                "requests",
                JSONArray()
                    .put(
                        JSONObject()
                            .put("requestId", "req-lowercase")
                            .put("type", "unknown_server_type")
                            .put("status", "pending")
                            .put("createdAt", "not-an-iso-date")
                            .put("assignmentState", "unassigned")
                            .put(
                                "location",
                                JSONObject()
                                    .put("latitude", 41.043)
                                    .put("longitude", 29.009)
                            )
                    )
            )
            .put("total", 1)

        val parsed = ActiveHelpRequestsRepository.parseActiveHelpRequestsResponse(response)
        val request = parsed.requests.first()

        assertEquals(1, parsed.requests.size)
        assertEquals(0, parsed.skippedCount)
        assertEquals(300, parsed.limit)
        assertEquals(0, parsed.offset)
        assertEquals(CrisisRequestType.OTHER, request.type)
        assertEquals("Other / Unknown", request.typeLabel)
        assertEquals("MEDIUM", request.priorityLevel)
        assertEquals("unknown", request.city)
        assertEquals("unknown", request.district)
        assertEquals("not-an-iso-date", ActiveHelpRequestsRepository.formatOpenedAt(request.createdAt))
    }

    @Test
    fun normalizeRequestType_groupsFoodWaterAndSearchRescueTypes() {
        assertEquals(CrisisRequestType.FOOD_WATER, ActiveHelpRequestsRepository.normalizeRequestType("food"))
        assertEquals(CrisisRequestType.FOOD_WATER, ActiveHelpRequestsRepository.normalizeRequestType("water"))
        assertEquals(CrisisRequestType.FOOD_WATER, ActiveHelpRequestsRepository.normalizeRequestType("food_water"))
        assertEquals(CrisisRequestType.SEARCH_AND_RESCUE, ActiveHelpRequestsRepository.normalizeRequestType("search_rescue"))
        assertEquals(CrisisRequestType.SEARCH_AND_RESCUE, ActiveHelpRequestsRepository.normalizeRequestType("fire_brigade"))
        assertEquals(CrisisRequestType.SEARCH_AND_RESCUE, ActiveHelpRequestsRepository.normalizeRequestType("search_and_rescue"))
        assertEquals(CrisisRequestType.SEARCH_AND_RESCUE, ActiveHelpRequestsRepository.normalizeRequestType("sar"))
        assertEquals(CrisisRequestType.SEARCH_AND_RESCUE, ActiveHelpRequestsRepository.normalizeRequestType("rescue"))
        assertEquals(CrisisRequestType.OTHER, ActiveHelpRequestsRepository.normalizeRequestType("unknown"))
    }

    @Test
    fun formatOpenedAtUsesRelativeDayLabels() {
        withDefaultTimeZone("Europe/Istanbul") {
            assertEquals(
                "Today, 13:15",
                ActiveHelpRequestsRepository.formatOpenedAt(
                    createdAt = "2026-05-11T10:15:00.000Z",
                    nowInstant = Instant.parse("2026-05-11T18:00:00.000Z")
                )
            )
            assertEquals(
                "Yesterday, 23:30",
                ActiveHelpRequestsRepository.formatOpenedAt(
                    createdAt = "2026-05-10T20:30:00.000Z",
                    nowInstant = Instant.parse("2026-05-11T10:00:00.000Z")
                )
            )
        }
    }

    private fun withDefaultTimeZone(id: String, block: () -> Unit) {
        val previous = TimeZone.getDefault()
        try {
            TimeZone.setDefault(TimeZone.getTimeZone(id))
            block()
        } finally {
            TimeZone.setDefault(previous)
        }
    }
}
