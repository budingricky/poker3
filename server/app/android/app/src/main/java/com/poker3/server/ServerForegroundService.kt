package com.poker3.server

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo as AndroidServiceInfo
import android.net.wifi.WifiManager
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.util.concurrent.atomic.AtomicBoolean
import javax.jmdns.JmDNS
import javax.jmdns.ServiceInfo

class ServerForegroundService : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val starting = AtomicBoolean(false)
    private var ktorServer: KtorServer? = null
    private var multicastLock: WifiManager.MulticastLock? = null
    private var jmDns: JmDNS? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        AppLogger.i("Service", "onCreate")
        ensureChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action
        AppLogger.i("Service", "onStartCommand action=$action")

        when (action) {
            ACTION_STOP -> {
                stopServer()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            }
            else -> {
                val notification = buildNotification("启动中…")
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    startForeground(
                        NOTIFICATION_ID,
                        notification,
                        AndroidServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
                    )
                } else {
                    startForeground(NOTIFICATION_ID, notification)
                }
                startServerIfNeeded()
                return START_STICKY
            }
        }
    }

    override fun onDestroy() {
        AppLogger.i("Service", "onDestroy")
        stopServer()
        super.onDestroy()
    }

    private fun startServerIfNeeded() {
        if (starting.getAndSet(true)) return
        scope.launch {
            try {
                acquireMulticastLock()
                if (ktorServer == null) {
                    ktorServer = KtorServer(applicationContext)
                }
                val port = ktorServer?.start()
                val ip = getLocalIpAddress()
                if (port != null && ip != null) {
                    val url = "http://$ip:$port"
                    updateNotification("运行中：$url")
                    runningAddress = url
                    runningPort = port
                    isRunning = true
                    startJmDns(ip, port)
                    AppLogger.i("Service", "Server running $url")
                } else {
                    updateNotification("启动失败：请检查网络/权限")
                    AppLogger.e("Service", "Server start failed ip=$ip port=$port")
                }
            } catch (e: Exception) {
                AppLogger.e("Service", "Start server crashed", e)
                updateNotification("启动异常：${e.javaClass.simpleName}")
            } finally {
                starting.set(false)
            }
        }
    }

    private fun stopServer() {
        try {
            ktorServer?.stop()
        } catch (e: Exception) {
            AppLogger.e("Service", "Stop server failed", e)
        } finally {
            ktorServer = null
            isRunning = false
            runningAddress = null
            runningPort = null
            stopJmDns()
            releaseMulticastLock()
        }
    }

    private fun updateNotification(content: String) {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(NOTIFICATION_ID, buildNotification(content))
    }

    private fun buildNotification(content: String): Notification {
        val openIntent = Intent(this, MainActivity::class.java)
        val piFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }
        val contentIntent = PendingIntent.getActivity(this, 0, openIntent, piFlags)

        val stopIntent = Intent(this, ServerForegroundService::class.java).apply { action = ACTION_STOP }
        val stopPendingIntent = PendingIntent.getService(this, 1, stopIntent, piFlags)

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("挖坑服务器")
            .setContentText(content)
            .setSmallIcon(android.R.drawable.stat_sys_download_done)
            .setContentIntent(contentIntent)
            .setOngoing(true)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "停止", stopPendingIntent)
            .build()
    }

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val existing = nm.getNotificationChannel(CHANNEL_ID)
        if (existing != null) return
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Poker3 Server",
            NotificationManager.IMPORTANCE_LOW
        )
        nm.createNotificationChannel(channel)
    }

    private fun getLocalIpAddress(): String? {
        return NetUtil.getPrimaryIPv4Address()
    }

    private fun acquireMulticastLock() {
        try {
            if (multicastLock != null) return
            val wifi = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
            multicastLock = wifi.createMulticastLock("poker3-mdns").apply {
                setReferenceCounted(false)
                acquire()
            }
            AppLogger.i("mDNS", "MulticastLock acquired")
        } catch (e: Exception) {
            AppLogger.e("mDNS", "MulticastLock acquire failed", e)
        }
    }

    private fun releaseMulticastLock() {
        try {
            multicastLock?.release()
        } catch (_: Exception) {
        } finally {
            multicastLock = null
            AppLogger.i("mDNS", "MulticastLock released")
        }
    }

    private fun startJmDns(ip: String, port: Int) {
        try {
            if (jmDns != null) return
            val addr = java.net.InetAddress.getByName(ip)
            jmDns = JmDNS.create(addr, "poker3")
            val info = ServiceInfo.create("_http._tcp.local.", "poker3", port, "path=/")
            jmDns?.registerService(info)
            AppLogger.i("mDNS", "JmDNS registered poker3.local:$port on $ip")
        } catch (e: Exception) {
            AppLogger.e("mDNS", "JmDNS start failed", e)
        }
    }

    private fun stopJmDns() {
        try {
            jmDns?.unregisterAllServices()
            jmDns?.close()
        } catch (_: Exception) {
        } finally {
            jmDns = null
            AppLogger.i("mDNS", "JmDNS stopped")
        }
    }

    companion object {
        private const val CHANNEL_ID = "poker3_server"
        private const val NOTIFICATION_ID = 32101
        const val ACTION_START = "com.poker3.server.action.START"
        const val ACTION_STOP = "com.poker3.server.action.STOP"

        @Volatile var isRunning: Boolean = false
        @Volatile var runningPort: Int? = null
        @Volatile var runningAddress: String? = null

        fun start(context: Context) {
            val intent = Intent(context, ServerForegroundService::class.java).apply { action = ACTION_START }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stop(context: Context) {
            val intent = Intent(context, ServerForegroundService::class.java).apply { action = ACTION_STOP }
            context.startService(intent)
        }
    }
}
