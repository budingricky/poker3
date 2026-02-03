package com.poker3.server

import android.net.wifi.WifiManager
import android.os.Bundle
import android.text.format.Formatter
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {

    private var ktorServer: KtorServer? = null
    private var isRunning = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        val tvStatus = findViewById<TextView>(R.id.tvStatus)
        val tvIp = findViewById<TextView>(R.id.tvIp)
        val btnToggle = findViewById<Button>(R.id.btnToggle)

        btnToggle.setOnClickListener {
            if (isRunning) {
                stopServer()
                tvStatus.text = "状态: 已停止"
                btnToggle.text = "启动服务器"
                isRunning = false
            } else {
                startServer()
                tvStatus.text = "状态: 运行中"
                val ip = getIpAddress()
                tvIp.text = "请访问: http://$ip:8080\n或尝试: http://poker3.local"
                btnToggle.text = "停止服务器"
                isRunning = true
            }
        }
    }

    private fun startServer() {
        ktorServer = KtorServer(this)
        CoroutineScope(Dispatchers.IO).launch {
            ktorServer?.start()
        }
    }

    private fun stopServer() {
        CoroutineScope(Dispatchers.IO).launch {
            ktorServer?.stop()
        }
    }

    private fun getIpAddress(): String {
        val wifiManager = applicationContext.getSystemService(WIFI_SERVICE) as WifiManager
        return Formatter.formatIpAddress(wifiManager.connectionInfo.ipAddress)
    }
}
