package com.beddybytes.android

import android.app.Application
import com.beddybytes.android.infrastructure.AppContainer

class BeddyBytesApplication : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
        container.authorizationSession.start()
    }
}
