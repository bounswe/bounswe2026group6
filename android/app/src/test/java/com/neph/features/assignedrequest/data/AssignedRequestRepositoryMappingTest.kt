package com.neph.features.assignedrequest.data

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import org.json.JSONArray
import org.json.JSONObject
import java.util.TimeZone

class AssignedRequestRepositoryMappingTest {
    private lateinit var previousTimeZone: TimeZone

    @Before
    fun setUp() {
        previousTimeZone = TimeZone.getDefault()
        TimeZone.setDefault(TimeZone.getTimeZone("UTC"))
    }

    @After
    fun tearDown() {
        TimeZone.setDefault(previousTimeZone)
    }

    @Test
    fun mapAssignmentIncludesUrgencyPriorityAndAgingLabels() {
        val assignment = JSONObject().apply {
            put("assignment_id", "asg_1")
            put("request_id", "req_1")
            put("need_type", "food_water")
            put("help_types", JSONArray(listOf("food_water")))
            put("description", "Need bottled water")
            put("request_status", "ASSIGNED")
            put("urgency_level", "HIGH")
            put("priority_level", "HIGH")
            put("opened_at", "2026-04-26T10:00:00.000Z")
            put("assigned_at", "2026-04-26T10:20:00.000Z")
            put("request_city", "Istanbul")
            put("request_district", "Besiktas")
            put("latitude", 41.043)
            put("longitude", 29.009)
        }

        val model = AssignedRequestRepository.run {
            mapAssignmentEntity(assignment, syncStatus = "SYNCED").toUiModel()
        }

        assertEquals("High", model.urgencyLabel)
        assertEquals("High", model.priorityLabel)
        assertEquals("2026-04-26 10:00:00", model.openedAtLabel)
        assertEquals("Assigned to you", model.statusLabel)
        assertEquals(41.043, model.latitude ?: 0.0, 0.0)
        assertEquals(29.009, model.longitude ?: 0.0, 0.0)
    }
}
