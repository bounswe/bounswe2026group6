package com.neph.core

import android.content.Context

object NephAppContext {
    private var appContext: Context? = null

    fun initialize(context: Context) {
        appContext = context.applicationContext
    }

    fun get(): Context = checkNotNull(appContext) {
        "NephAppContext must be initialized before use."
    }

    fun getOrNull(): Context? = appContext
}
