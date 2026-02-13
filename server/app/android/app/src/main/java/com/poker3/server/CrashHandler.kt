package com.poker3.server

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object CrashHandler {
    private val df = SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS", Locale.US)

    fun install() {
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { t, e ->
            try {
                val header = "==== CRASH ${df.format(Date())} thread=${t.name} ===="
                AppLogger.appendCrash(header)
                AppLogger.appendCrash(e.stackTraceToString())
            } catch (_: Exception) {
            }
            previous?.uncaughtException(t, e)
        }
    }
}
