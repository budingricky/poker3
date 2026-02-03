package com.poker3.server

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import io.ktor.serialization.gson.*
import io.ktor.server.application.*
import io.ktor.server.engine.*
import io.ktor.server.http.content.*
import io.ktor.server.netty.*
import io.ktor.server.plugins.contentnegotiation.*
import io.ktor.server.plugins.cors.routing.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.server.websocket.*
import io.ktor.websocket.*
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.time.Duration
import java.util.Collections

class KtorServer(private val context: Context) {
    private var server: NettyApplicationEngine? = null
    private var nsdManager: NsdManager? = null
    private var registrationListener: NsdManager.RegistrationListener? = null
    
    // Track websocket sessions
    private val roomSessions = Collections.synchronizedMap(mutableMapOf<String, MutableList<DefaultWebSocketSession>>())

    fun start() {
        // Try port 80 first, fallback to 8080
        try {
            startServer(80)
        } catch (e: Exception) {
            e.printStackTrace()
            try {
                startServer(8080)
            } catch (e2: Exception) {
                e2.printStackTrace()
            }
        }
    }

    private fun startServer(port: Int) {
        server = embeddedServer(Netty, port = port, host = "0.0.0.0") {
            install(ContentNegotiation) {
                gson {}
            }
            install(CORS) {
                anyHost()
                allowHeader(io.ktor.http.HttpHeaders.ContentType)
            }
            install(WebSockets) {
                pingPeriod = Duration.ofSeconds(15)
                timeout = Duration.ofSeconds(15)
                maxFrameSize = Long.MAX_VALUE
                masking = false
            }

            routing {
                // Serve Web Assets (React Frontend)
                staticResources("/", "web", index = "index.html")
                
                // Fallback for SPA routing (React Router)
                // If file not found, serve index.html
                // Note: Ktor static doesn't easily support SPA fallback out of box without custom interceptor
                // Simple workaround: explicit routes or catch-all
                get("/{...}") {
                    val uri = call.request.uri
                    if (!uri.startsWith("/api") && !uri.contains(".")) {
                        call.respondBytes(
                            context.assets.open("web/index.html").readBytes(),
                            io.ktor.http.ContentType.Text.Html
                        )
                    } else {
                         // Let static resources handle it or 404
                         // Actually staticResources handles exact matches.
                         // We need to try serving file, if fail, index.html?
                         // For simplicity, we assume standard assets are served by staticResources
                    }
                }

                route("/api") {
                    route("/room") {
                        get {
                            call.respond(ApiResponse(true, RoomService.getAllRooms()))
                        }
                        
                        get("/{roomId}") {
                            val roomId = call.parameters["roomId"] ?: return@get
                            val room = RoomService.getRoom(roomId)
                            if (room != null) call.respond(ApiResponse(true, room))
                            else call.respond(ApiResponse<Any>(false, error = "房间未找到"))
                        }

                        post("/create") {
                            try {
                                val req = call.receive<CreateRoomRequest>()
                                val room = RoomService.createRoom(req.playerName, req.roomName ?: "${req.playerName}的房间", req.playerId)
                                call.respond(ApiResponse(true, mapOf("room" to room, "player" to room.players[0])))
                            } catch (e: Exception) {
                                call.respond(ApiResponse<Any>(false, error = e.message))
                            }
                        }

                        post("/join") {
                            try {
                                val req = call.receive<JoinRoomRequest>()
                                val result = RoomService.joinRoom(req.roomId, req.playerName, req.playerId)
                                call.respond(ApiResponse(true, mapOf("player" to result.first, "room" to result.second)))
                            } catch (e: Exception) {
                                call.respond(ApiResponse<Any>(false, error = e.message))
                            }
                        }
                        
                        post("/leave") {
                            try {
                                val req = call.receive<LeaveRoomRequest>()
                                val result = RoomService.removePlayer(req.roomId, req.playerId)
                                call.respond(ApiResponse(true, mapOf("roomDeleted" to result.first, "newHostId" to result.second)))
                            } catch (e: Exception) {
                                call.respond(ApiResponse<Any>(false, error = e.message))
                            }
                        }
                        
                        post("/close") {
                            try {
                                val req = call.receive<LeaveRoomRequest>() // Reusing LeaveRoomRequest structure (roomId, playerId)
                                RoomService.closeRoom(req.roomId, req.playerId)
                                broadcastToRoom(req.roomId, "room_closed", null)
                                call.respond(ApiResponse(true, mapOf("closed" to true)))
                            } catch (e: Exception) {
                                call.respond(ApiResponse<Any>(false, error = e.message))
                            }
                        }

                        post("/start") {
                            try {
                                val req = call.receive<StartGameRequest>()
                                GameService.startGame(req.roomId)
                                broadcastToRoom(req.roomId, "game_started", mapOf("roomId" to req.roomId))
                                call.respond(ApiResponse(true, mapOf("status" to "started")))
                            } catch (e: Exception) {
                                call.respond(ApiResponse<Any>(false, error = e.message))
                            }
                        }

                        post("/bid") {
                            try {
                                val req = call.receive<BidRequest>()
                                GameService.handleBid(req.roomId, req.playerId, req.score)
                                broadcastToRoom(req.roomId, "game_update", null)
                                call.respond(ApiResponse(true, mapOf("status" to "bid")))
                            } catch (e: Exception) {
                                call.respond(ApiResponse<Any>(false, error = e.message))
                            }
                        }

                        post("/play") {
                            try {
                                val req = call.receive<PlayCardsRequest>()
                                GameService.handlePlayCards(req.roomId, req.playerId, req.cards)
                                
                                // Check if finished
                                val state = GameService.getGameState(req.roomId, req.playerId)
                                if (state?.get("phase") == "FINISHED") {
                                    broadcastToRoom(req.roomId, "game_over", mapOf("winnerId" to req.playerId))
                                } else {
                                    broadcastToRoom(req.roomId, "game_update", null)
                                }
                                
                                call.respond(ApiResponse(true, mapOf("status" to "played")))
                            } catch (e: Exception) {
                                call.respond(ApiResponse<Any>(false, error = e.message))
                            }
                        }

                        post("/pass") {
                            try {
                                val req = call.receive<PassRequest>()
                                GameService.handlePass(req.roomId, req.playerId)
                                broadcastToRoom(req.roomId, "game_update", null)
                                call.respond(ApiResponse(true, mapOf("status" to "passed")))
                            } catch (e: Exception) {
                                call.respond(ApiResponse<Any>(false, error = e.message))
                            }
                        }
                        
                        get("/{roomId}/game/{playerId}") {
                            val roomId = call.parameters["roomId"] ?: return@get
                            val playerId = call.parameters["playerId"] ?: return@get
                            val state = GameService.getGameState(roomId, playerId)
                            if (state != null) call.respond(ApiResponse(true, state))
                            else call.respond(ApiResponse<Any>(false, error = "游戏未找到"))
                        }
                    }
                }

                // WebSocket
                webSocket("/ws") { // Simplified single endpoint, clients send roomId in join message?
                   // Actually front-end expects socket.io which is complex.
                   // We moved to native websocket.
                   // Let's implement a simple protocol.
                   try {
                       for (frame in incoming) {
                           if (frame is Frame.Text) {
                               val text = frame.readText()
                               // Simple JSON protocol? Or just "join_room:roomId"
                               // Let's assume JSON for robustness or simple string splitting
                               if (text.startsWith("join_room:")) {
                                   val roomId = text.substringAfter("join_room:")
                                   roomSessions.computeIfAbsent(roomId) { Collections.synchronizedList(mutableListOf()) }.add(this)
                               }
                           }
                       }
                   } finally {
                       // Remove session from all rooms
                       roomSessions.values.forEach { it.remove(this) }
                   }
                }
            }
        }.start(wait = false)
        
        registerMdns(port)
    }

    private fun registerMdns(port: Int) {
        try {
            nsdManager = context.getSystemService(Context.NSD_SERVICE) as NsdManager
            val serviceInfo = NsdServiceInfo().apply {
                serviceName = "poker3"
                serviceType = "_http._tcp."
                setPort(port)
            }
            
            registrationListener = object : NsdManager.RegistrationListener {
                override fun onServiceRegistered(NsdServiceInfo: NsdServiceInfo) {
                    println("MDNS Registered: ${NsdServiceInfo.serviceName}")
                }
                override fun onRegistrationFailed(serviceInfo: NsdServiceInfo, errorCode: Int) {
                    println("MDNS Registration failed: $errorCode")
                }
                override fun onServiceUnregistered(arg0: NsdServiceInfo) {}
                override fun onUnregistrationFailed(serviceInfo: NsdServiceInfo, errorCode: Int) {}
            }

            nsdManager?.registerService(serviceInfo, NsdManager.PROTOCOL_DNS_SD, registrationListener)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    fun stop() {
        server?.stop(1000, 1000)
        nsdManager?.unregisterService(registrationListener)
    }
    
    private fun broadcastToRoom(roomId: String, type: String, data: Any?) {
        val sessions = roomSessions[roomId] ?: return
        val message = "{\"type\":\"$type\"}" // Simple JSON
        CoroutineScope(Dispatchers.IO).launch {
            sessions.forEach { 
                try {
                    it.send(Frame.Text(message))
                } catch (e: Exception) {
                    // Ignore closed sessions
                }
            }
        }
    }
}
