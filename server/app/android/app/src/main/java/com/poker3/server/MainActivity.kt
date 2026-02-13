package com.poker3.server

import android.os.Bundle
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineExceptionHandler
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import android.os.PowerManager

class MainActivity : AppCompatActivity() {

    private var ktorServer: KtorServer? = null
    private var isRunning = false
    private var addressText: String = "-"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        val tvStatus = findViewById<TextView>(R.id.tvStatus)
        val tvAddress = findViewById<TextView>(R.id.tvAddress)
        val tvLogs = findViewById<TextView>(R.id.tvLogs)
        val tvLastCrash = findViewById<TextView>(R.id.tvLastCrash)
        val btnToggle = findViewById<Button>(R.id.btnToggle)
        val btnCopy = findViewById<Button>(R.id.btnCopy)
        val btnCopyCrash = findViewById<Button>(R.id.btnCopyCrash)
        val btnCopyLogs = findViewById<Button>(R.id.btnCopyLogs)
        val btnClearLogs = findViewById<Button>(R.id.btnClearLogs)
        val btnBg = findViewById<Button>(R.id.btnBg)

        fun showLastCrash() {
            val lastCrash = AppLogger.readLastCrash()
            tvLastCrash.text = lastCrash ?: ""
        }
        showLastCrash()

        fun refreshLogs() {
            tvLogs.text = AppLogger.getLines().joinToString("\n\n")
        }
        refreshLogs()

        btnCopyCrash.setOnClickListener {
            val crashText = AppLogger.readLastCrash() ?: ""
            val cm = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            cm.setPrimaryClip(ClipData.newPlainText("Poker3 Crash", crashText))
            AppLogger.i("UI", "Copied crash log")
            refreshLogs()
        }

        btnToggle.setOnClickListener {
            if (isRunning) {
                ServerForegroundService.stop(this)
                tvStatus.text = "状态: 已停止"
                btnToggle.text = "启动服务器"
                isRunning = false
                addressText = "-"
                tvAddress.text = "地址: -"
                AppLogger.i("UI", "Server stopped by user")
                refreshLogs()
            } else {
                tvStatus.text = "状态: 启动中..."
                btnToggle.isEnabled = false
                AppLogger.i("UI", "Start button clicked")
                refreshLogs()
                val handler = CoroutineExceptionHandler { _, e ->
                    AppLogger.e("UI", "Start coroutine crashed", e)
                    runOnUiThread {
                        btnToggle.isEnabled = true
                        tvStatus.text = "状态: 启动失败"
                        addressText = "-"
                        tvAddress.text = "地址: -"
                        btnToggle.text = "启动服务器"
                        isRunning = false
                        showLastCrash()
                        refreshLogs()
                    }
                }
                CoroutineScope(Dispatchers.IO + handler).launch {
                    ServerForegroundService.start(this@MainActivity)
                    val port = waitPort()
                    val ip = NetUtil.getPrimaryIPv4Address()
                    val ips = NetUtil.getPreferredIPv4Addresses()
                    CoroutineScope(Dispatchers.Main).launch {
                        btnToggle.isEnabled = true
                        if (port == null || ip == null) {
                            tvStatus.text = "状态: 启动失败"
                            addressText = "-"
                            tvAddress.text = "地址: -"
                            btnToggle.text = "启动服务器"
                            isRunning = false
                            AppLogger.e("UI", "Start failed ip=$ip port=$port")
                            showLastCrash()
                        } else {
                            tvStatus.text = "状态: 运行中"
                            addressText = "http://$ip:$port"
                            val candidates = if (ips.isNotEmpty()) ips.joinToString(", ") else "-"
                            tvAddress.text = "地址: $addressText\n备用: http://poker3.local:$port\n本机IP: $candidates"
                            btnToggle.text = "停止服务器"
                            isRunning = true
                            AppLogger.i("UI", "Started $addressText")
                        }
                        refreshLogs()
                    }
                }
            }
        }

        btnCopy.setOnClickListener {
            val cm = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            cm.setPrimaryClip(ClipData.newPlainText("Poker3 Server Address", addressText))
            AppLogger.i("UI", "Copied address $addressText")
            refreshLogs()
        }

        btnCopyLogs.setOnClickListener {
            val text = AppLogger.getLines().joinToString("\n\n")
            val cm = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            cm.setPrimaryClip(ClipData.newPlainText("Poker3 Logs", text))
            AppLogger.i("UI", "Copied logs")
            refreshLogs()
        }

        btnClearLogs.setOnClickListener {
            AppLogger.clear()
            AppLogger.clearCrash()
            tvLastCrash.text = ""
            refreshLogs()
        }

        btnBg.setOnClickListener {
            requestIgnoreBatteryOptimizations()
        }

        updateFromService(tvStatus, tvAddress, btnToggle)
    }

    private fun updateFromService(tvStatus: TextView, tvAddress: TextView, btnToggle: Button) {
        if (ServerForegroundService.isRunning && ServerForegroundService.runningPort != null) {
            val port = ServerForegroundService.runningPort!!
            val ip = NetUtil.getPrimaryIPv4Address()
            val ips = NetUtil.getPreferredIPv4Addresses()
            tvStatus.text = "状态: 运行中"
            addressText = if (ip != null) "http://$ip:$port" else (ServerForegroundService.runningAddress ?: "-")
            val candidates = if (ips.isNotEmpty()) ips.joinToString(", ") else "-"
            tvAddress.text = "地址: $addressText\n备用: http://poker3.local:$port\n本机IP: $candidates"
            btnToggle.text = "停止服务器"
            isRunning = true
        }
    }

    private suspend fun waitPort(): Int? {
        for (i in 0 until 30) {
            val port = ServerForegroundService.runningPort
            if (ServerForegroundService.isRunning && port != null) return port
            kotlinx.coroutines.delay(200)
        }
        return ServerForegroundService.runningPort
    }

    private fun requestIgnoreBatteryOptimizations() {
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            if (pm.isIgnoringBatteryOptimizations(packageName)) return
            val intent = Intent(android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
            intent.data = Uri.parse("package:$packageName")
            startActivity(intent)
        } catch (e: Exception) {
            AppLogger.e("UI", "Request battery optimization failed", e)
        }
    }
}
