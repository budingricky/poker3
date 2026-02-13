package com.poker3.server

import android.app.Application

class Poker3Application : Application() {
    override fun onCreate() {
        super.onCreate()
        AppLogger.init(this)
        CrashHandler.install()
        val lastCrash = AppLogger.readLastCrash()
        if (lastCrash != null) {
            AppLogger.w("Crash", "Detected previous crash log")
        }
    }
}
