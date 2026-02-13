package com.poker3.server

import java.net.Inet4Address
import java.net.NetworkInterface

object NetUtil {
    private fun scoreInterface(name: String): Int {
        val n = name.lowercase()
        return when {
            n.contains("wlan") || n.contains("wifi") -> 100
            n.contains("ap") || n.contains("hotspot") -> 90
            n.startsWith("eth") || n.contains("rmnet") -> 80
            else -> 10
        }
    }

    fun getPreferredIPv4Addresses(): List<String> {
        return try {
            val results = mutableListOf<Pair<Int, String>>()
            val interfaces = NetworkInterface.getNetworkInterfaces()
            while (interfaces.hasMoreElements()) {
                val nif = interfaces.nextElement()
                if (!nif.isUp || nif.isLoopback) continue
                val score = scoreInterface(nif.name ?: "")
                val addrs = nif.inetAddresses
                while (addrs.hasMoreElements()) {
                    val addr = addrs.nextElement()
                    if (addr is Inet4Address && !addr.isLoopbackAddress) {
                        val host = addr.hostAddress ?: continue
                        if (host.startsWith("169.254.")) continue
                        results.add(Pair(score, host))
                    }
                }
            }
            results
                .sortedWith(compareByDescending<Pair<Int, String>> { it.first }.thenBy { it.second })
                .map { it.second }
                .distinct()
        } catch (_: Exception) {
            emptyList()
        }
    }

    fun getPrimaryIPv4Address(): String? {
        return getPreferredIPv4Addresses().firstOrNull()
    }

    fun getLocalIpAddress(): String? {
        return getPrimaryIPv4Address()
    }
}
