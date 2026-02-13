package com.poker3.server

import android.content.Context
import android.util.Log
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.CopyOnWriteArrayList

object AppLogger {
    private const val MAX_LINES = 400
    private val dateFormat = SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS", Locale.US)
    private val buffer = CopyOnWriteArrayList<String>()
    @Volatile private var logFile: File? = null
    @Volatile private var crashFile: File? = null

    fun init(context: Context) {
        val dir = File(context.filesDir, "logs")
        if (!dir.exists()) dir.mkdirs()
        logFile = File(dir, "server.log")
        crashFile = File(dir, "crash.log")
    }

    fun d(tag: String, msg: String) = write("D", tag, msg, null)
    fun i(tag: String, msg: String) = write("I", tag, msg, null)
    fun w(tag: String, msg: String) = write("W", tag, msg, null)
    fun e(tag: String, msg: String, tr: Throwable? = null) = write("E", tag, msg, tr)

    fun getLines(): List<String> = buffer.toList()

    fun clear() {
        buffer.clear()
        try { logFile?.writeText("") } catch (_: Exception) {}
    }

    fun readLastCrash(): String? {
        return try {
            val f = crashFile ?: return null
            if (!f.exists()) return null
            val text = f.readText()
            if (text.isBlank()) null else text
        } catch (_: Exception) {
            null
        }
    }

    fun clearCrash() {
        try { crashFile?.writeText("") } catch (_: Exception) {}
    }

    fun appendCrash(text: String) {
        try {
            crashFile?.appendText(text + "\n")
        } catch (_: Exception) {
        }
    }

    private fun write(level: String, tag: String, msg: String, tr: Throwable?) {
        val ts = dateFormat.format(Date())
        val line = buildString {
            append(ts)
            append(" ")
            append(level)
            append("/")
            append(tag)
            append(" ")
            append(msg)
            if (tr != null) {
                append("\n")
                append(tr.stackTraceToString())
            }
        }

        buffer.add(line)
        while (buffer.size > MAX_LINES) {
            buffer.removeAt(0)
        }

        try {
            logFile?.appendText(line + "\n")
        } catch (_: Exception) {
        }

        try {
            val priority = when (level) {
                "E" -> Log.ERROR
                "W" -> Log.WARN
                "I" -> Log.INFO
                else -> Log.DEBUG
            }
            Log.println(priority, tag, msg)
            if (tr != null) Log.println(priority, tag, tr.stackTraceToString())
        } catch (_: Exception) {
        }
    }
}
