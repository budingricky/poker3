package com.poker3.server

import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.util.concurrent.atomic.AtomicBoolean

class UdpDiscovery(private val httpPort: Int) {
    private val running = AtomicBoolean(false)
    private var socket: DatagramSocket? = null
    private var thread: Thread? = null

    fun start() {
        if (running.getAndSet(true)) return
        thread = Thread {
            try {
                val s = DatagramSocket(DISCOVERY_PORT, InetAddress.getByName("0.0.0.0"))
                s.broadcast = true
                socket = s
                AppLogger.i("UDP", "Discovery listening udp:$DISCOVERY_PORT httpPort=$httpPort")
                val buf = ByteArray(2048)
                while (running.get()) {
                    val packet = DatagramPacket(buf, buf.size)
                    s.receive(packet)
                    val msg = try { String(packet.data, 0, packet.length) } catch (e: Exception) { "" }
                    if (!msg.contains("poker3", ignoreCase = true)) continue

                    val ip = NetUtil.getLocalIpAddress() ?: ""
                    val response = """{"type":"poker3_discovery_response","ip":"$ip","httpPort":$httpPort,"wsPath":"/ws","apiPrefix":"/api"}"""
                    val out = response.toByteArray()
                    val respPacket = DatagramPacket(out, out.size, packet.address, packet.port)
                    s.send(respPacket)
                    AppLogger.d("UDP", "Responded to ${packet.address.hostAddress}:${packet.port}")
                }
            } catch (e: Exception) {
                AppLogger.e("UDP", "Discovery crashed", e)
            } finally {
                try { socket?.close() } catch (e: Exception) {}
                socket = null
                running.set(false)
            }
        }
        thread?.isDaemon = true
        thread?.start()
    }

    fun stop() {
        running.set(false)
        try { socket?.close() } catch (e: Exception) {}
        socket = null
        try { thread?.interrupt() } catch (e: Exception) {}
        thread = null
        AppLogger.i("UDP", "Discovery stopped")
    }

    companion object {
        const val DISCOVERY_PORT = 32100
    }
}
