package com.poker3.server

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import com.google.gson.Gson
import io.ktor.serialization.gson.*
import io.ktor.server.application.*
import io.ktor.server.engine.*
import io.ktor.server.netty.*
import io.ktor.server.plugins.contentnegotiation.*
import io.ktor.server.plugins.cors.routing.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.server.plugins.statuspages.*
import io.ktor.server.websocket.*
import io.ktor.websocket.*
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeoutOrNull
import java.time.Duration
import java.util.Collections
import java.util.concurrent.ConcurrentHashMap
import io.ktor.util.AttributeKey

class KtorServer(private val androidContext: Context) {
    private var server: NettyApplicationEngine? = null
    private var nsdManager: NsdManager? = null
    private var registrationListener: NsdManager.RegistrationListener? = null
    private var udpDiscovery: UdpDiscovery? = null
    private var runningPort: Int? = null
    private val gson = Gson()
    
    // Track websocket sessions
    private val roomSessions = ConcurrentHashMap<String, MutableSet<DefaultWebSocketSession>>()
    private val lobbySessions = Collections.synchronizedSet(mutableSetOf<DefaultWebSocketSession>())

    fun start(): Int? {
        if (server != null) return runningPort
        AppLogger.i("Server", "Starting")
        return try {
            startServer(8080)
            AppLogger.i("Server", "Started on port=$runningPort")
            runningPort
        } catch (e: Exception) {
            AppLogger.e("Server", "Failed start on 8080, try 18080", e)
            try {
                startServer(18080)
                AppLogger.i("Server", "Started on port=$runningPort")
                runningPort
            } catch (e2: Exception) {
                AppLogger.e("Server", "Failed start", e2)
                null
            }
        }
    }

    private fun startServer(port: Int) {
        AppLogger.i("Server", "Binding http://0.0.0.0:$port")
        server = embeddedServer(Netty, port = port, host = "0.0.0.0") {
            install(ContentNegotiation) {
                gson {}
            }
            install(CORS) {
                anyHost()
                allowHeader(io.ktor.http.HttpHeaders.ContentType)
            }
            install(StatusPages) {
                exception<Throwable> { call, cause ->
                    AppLogger.e("HTTP", "Unhandled error ${call.request.httpMethod.value} ${call.request.uri}", cause)
                    call.respond(io.ktor.http.HttpStatusCode.InternalServerError, ApiResponse<Any>(false, error = "Server error"))
                }
            }
            install(WebSockets) {
                pingPeriod = Duration.ofSeconds(15)
                timeout = Duration.ofSeconds(15)
                maxFrameSize = Long.MAX_VALUE
                masking = false
            }

            intercept(ApplicationCallPipeline.Monitoring) {
                val cidKey = AttributeKey<String>("cid")
                if (!call.attributes.contains(cidKey)) {
                    call.attributes.put(cidKey, java.util.UUID.randomUUID().toString())
                }
                val start = System.currentTimeMillis()
                val method = call.request.httpMethod.value
                val uri = call.request.uri
                val remote = try { call.request.local.remoteHost } catch (_: Exception) { "-" }
                try {
                    proceed()
                } finally {
                    val status = call.response.status()?.value ?: 200
                    val ms = System.currentTimeMillis() - start
                    val cid = call.attributes[cidKey]
                    AppLogger.i("HTTP", "[$cid] $remote $method $uri -> $status (${ms}ms)")
                }
            }

            routing {
                get("/") {
                    call.respond(ApiResponse(true, mapOf("message" to "Poker3 API server")))
                }

                route("/api") {
                    get("/health") {
                        call.respond(ApiResponse(true, mapOf("message" to "ok")))
                    }
                    route("/admin") {
                        post("/logs/clear") {
                            AppLogger.i("HTTP", "Clear logs requested")
                            AppLogger.clear()
                            AppLogger.clearCrash()
                            call.respond(ApiResponse(true, mapOf("cleared" to true)))
                        }
                    }
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
                                broadcastLobby("room_update", null)
                            } catch (e: Exception) {
                                call.respond(ApiResponse<Any>(false, error = e.message))
                            }
                        }

                        post("/join") {
                            try {
                                val req = call.receive<JoinRoomRequest>()
                                val result = RoomService.joinRoom(req.roomId, req.playerName, req.playerId)
                                call.respond(ApiResponse(true, mapOf("player" to result.first, "room" to result.second)))
                                broadcastRoom(req.roomId, "room_update", null)
                                broadcastLobby("room_update", null)
                            } catch (e: Exception) {
                                call.respond(ApiResponse<Any>(false, error = e.message))
                            }
                        }
                        
                        post("/leave") {
                            try {
                                val req = call.receive<LeaveRoomRequest>()
                                val result = RoomService.removePlayer(req.roomId, req.playerId)
                                call.respond(ApiResponse(true, mapOf("roomDeleted" to result.first, "newHostId" to result.second)))
                                if (!result.first) {
                                    broadcastRoom(req.roomId, "room_update", null)
                                }
                                broadcastLobby("room_update", null)
                            } catch (e: Exception) {
                                call.respond(ApiResponse<Any>(false, error = e.message))
                            }
                        }
                        
                        post("/close") {
                            try {
                                val req = call.receive<LeaveRoomRequest>() // Reusing LeaveRoomRequest structure (roomId, playerId)
                                RoomService.closeRoom(req.roomId, req.playerId)
                                broadcastRoom(req.roomId, "room_closed", null)
                                call.respond(ApiResponse(true, mapOf("closed" to true)))
                                broadcastLobby("room_update", null)
                            } catch (e: Exception) {
                                call.respond(ApiResponse<Any>(false, error = e.message))
                            }
                        }

                        post("/start") {
                            try {
                                val req = call.receive<StartGameRequest>()
                                GameService.startGame(req.roomId)
                                broadcastRoom(req.roomId, "game_started", mapOf("roomId" to req.roomId))
                                broadcastRoom(req.roomId, "room_update", null)
                                broadcastLobby("room_update", null)
                                call.respond(ApiResponse(true, mapOf("status" to "started")))
                            } catch (e: Exception) {
                                call.respond(ApiResponse<Any>(false, error = e.message))
                            }
                        }

                        post("/bid") {
                            try {
                                val req = call.receive<BidRequest>()
                                GameService.handleBid(req.roomId, req.playerId, req.score)
                                val state = GameService.getGameState(req.roomId, req.playerId)
                                if (state?.get("phase") == "TAKING_HOLE") {
                                    val holeCards = state["holeCards"]
                                    broadcastRoom(req.roomId, "hole_revealed", mapOf("holeCards" to holeCards))
                                }
                                broadcastRoom(req.roomId, "game_update", null)
                                call.respond(ApiResponse(true, mapOf("status" to "bid")))
                            } catch (e: Exception) {
                                call.respond(ApiResponse<Any>(false, error = e.message))
                            }
                        }

                        post("/take_hole") {
                            try {
                                val req = call.receive<TakeHoleRequest>()
                                GameService.takeHoleCards(req.roomId, req.playerId)
                                broadcastRoom(req.roomId, "hole_taken", mapOf("diggerId" to req.playerId))
                                broadcastRoom(req.roomId, "game_update", null)
                                call.respond(ApiResponse(true, mapOf("status" to "taken")))
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
                                    val winnerSide = GameService.getWinnerSide(req.roomId, req.playerId)
                                    broadcastRoom(req.roomId, "game_over", mapOf("winnerId" to req.playerId, "winnerSide" to winnerSide))
                                    broadcastRoom(req.roomId, "room_update", null)
                                    broadcastLobby("room_update", null)
                                } else {
                                    broadcastRoom(req.roomId, "game_update", null)
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
                                broadcastRoom(req.roomId, "game_update", null)
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
                webSocket("/ws") {
                    var currentRoomId: String? = null
                    try {
                        for (frame in incoming) {
                            if (frame !is Frame.Text) continue
                            val text = frame.readText()
                            val parsed = try { gson.fromJson(text, Map::class.java) as Map<*, *> } catch (e: Exception) { null }
                            val event = parsed?.get("event") as? String ?: continue
                            val data = parsed["data"]

                            if (event == "join_room") {
                                val roomId = data as? String ?: continue
                                currentRoomId = roomId
                                roomSessions.computeIfAbsent(roomId) { Collections.synchronizedSet(mutableSetOf()) }.add(this)
                            }
                            if (event == "leave_room") {
                                val roomId = data as? String ?: currentRoomId
                                if (roomId != null) {
                                    roomSessions[roomId]?.remove(this)
                                    if (roomSessions[roomId]?.isEmpty() == true) roomSessions.remove(roomId)
                                }
                                if (currentRoomId == roomId) currentRoomId = null
                            }
                            if (event == "join_lobby") {
                                lobbySessions.add(this)
                            }
                            if (event == "leave_lobby") {
                                lobbySessions.remove(this)
                            }
                        }
                    } finally {
                        currentRoomId?.let { roomSessions[it]?.remove(this) }
                        lobbySessions.remove(this)
                    }
                }
            }
        }.start(wait = false)
        runningPort = port
        try {
            udpDiscovery = UdpDiscovery(port).also { it.start() }
        } catch (e: Exception) {
            AppLogger.e("Server", "UDP discovery start failed", e)
        }
        try {
            registerMdns(port)
        } catch (e: Exception) {
            AppLogger.e("Server", "mDNS register failed", e)
        }
    }

    private fun registerMdns(port: Int) {
        try {
            nsdManager = androidContext.getSystemService(Context.NSD_SERVICE) as NsdManager
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
        AppLogger.i("Server", "Stopping")
        try {
            runBlocking {
                withTimeoutOrNull(1500) {
                    val allSessions = LinkedHashSet<DefaultWebSocketSession>()
                    allSessions.addAll(lobbySessions)
                    roomSessions.values.forEach { allSessions.addAll(it) }
                    allSessions.forEach { session ->
                        try {
                            session.close(CloseReason(CloseReason.Codes.NORMAL, "server stopping"))
                        } catch (_: Exception) {
                        }
                    }
                }
            }
        } catch (e: Exception) {
            AppLogger.e("Server", "Close websocket sessions failed", e)
        } finally {
            roomSessions.clear()
            lobbySessions.clear()
        }
        try {
            server?.stop(2000, 5000)
        } catch (e: Exception) {
            AppLogger.e("Server", "Stop server failed", e)
        }
        try {
            val listener = registrationListener
            if (listener != null) nsdManager?.unregisterService(listener)
        } catch (e: Exception) {
            AppLogger.e("Server", "Unregister mDNS failed", e)
        }
        udpDiscovery?.stop()
        udpDiscovery = null
        registrationListener = null
        nsdManager = null
        server = null
        runningPort = null
        AppLogger.i("Server", "Stopped")
    }

    fun getPort(): Int? = runningPort

    private fun broadcastRoom(roomId: String, event: String, data: Any?) {
        val sessions = roomSessions[roomId] ?: return
        val message = gson.toJson(mapOf("event" to event, "data" to data))
        CoroutineScope(Dispatchers.IO).launch {
            sessions.forEach {
                try { it.send(Frame.Text(message)) } catch (e: Exception) {}
            }
        }
    }

    private fun broadcastLobby(event: String, data: Any?) {
        val message = gson.toJson(mapOf("event" to event, "data" to data))
        CoroutineScope(Dispatchers.IO).launch {
            lobbySessions.forEach {
                try { it.send(Frame.Text(message)) } catch (e: Exception) {}
            }
        }
    }
}
