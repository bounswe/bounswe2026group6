package com.neph.core.sync

object SyncStatus {
    const val SYNCED = "SYNCED"
    const val PENDING_CREATE = "PENDING_CREATE"
    const val PENDING_UPDATE = "PENDING_UPDATE"
    const val PENDING_DELETE = "PENDING_DELETE"
    const val FAILED = "FAILED"
    const val CONFLICTED = "CONFLICTED"
}

object SyncOperationStatus {
    const val PENDING = "PENDING"
    const val IN_PROGRESS = "IN_PROGRESS"
    const val SYNCED = "SYNCED"
    const val FAILED = "FAILED"
}

object SyncEntityType {
    const val HELP_REQUEST = "HELP_REQUEST"
    const val AVAILABILITY = "AVAILABILITY"
    const val ASSIGNED_REQUEST = "ASSIGNED_REQUEST"
    const val SAFETY_STATUS = "SAFETY_STATUS"
}

object SyncOperationType {
    const val CREATE_HELP_REQUEST = "CREATE_HELP_REQUEST"
    const val UPDATE_HELP_REQUEST = "UPDATE_HELP_REQUEST"
    const val UPDATE_HELP_REQUEST_STATUS = "UPDATE_HELP_REQUEST_STATUS"
    const val SET_AVAILABILITY = "SET_AVAILABILITY"
    const val CANCEL_ASSIGNMENT = "CANCEL_ASSIGNMENT"
    const val SET_SAFETY_STATUS = "SET_SAFETY_STATUS"
}

object LocalOwnerType {
    const val AUTHENTICATED = "AUTHENTICATED"
    const val GUEST = "GUEST"
}
