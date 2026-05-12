package com.neph.features.requesthelp.presentation

import org.junit.Assert.assertEquals
import org.junit.Test

class RequestHelpActionLabelTest {
    @Test
    fun primaryActionLabelUsesSendHelpRequestForCreateMode() {
        assertEquals("Send Help Request", requestHelpPrimaryActionLabel(null))
        assertEquals("Send Help Request", requestHelpPrimaryActionLabel(""))
    }

    @Test
    fun primaryActionLabelUsesSaveChangesForEditMode() {
        assertEquals("Save Changes", requestHelpPrimaryActionLabel("local-request-1"))
    }
}
