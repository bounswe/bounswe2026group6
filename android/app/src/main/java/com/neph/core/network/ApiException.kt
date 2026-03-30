package com.neph.core.network

class ApiException(
    override val message: String,
    val status: Int,
    val code: String? = null
) : Exception(message)
