package com.poker3.server

import android.app.Service
import android.content.Intent
import android.os.IBinder
import io.ktor.server.application.*
import io.ktor.server.engine.*
import io.ktor.server.netty.*
import io.ktor.server.plugins.contentnegotiation.*
import io.ktor.server.plugins.cors.routing.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.server.http.content.*
import io.ktor.server.websocket.*
import io.ktor.serialization.gson.*
import io.ktor.http.*
import io.ktor.websocket.*
import com.google.gson.Gson
import java.time.Duration
import java.util.Collections
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import kotlinx.coroutines.launch

// Data Models
data class Player(
    val id: String,
    val name: String,
    val roomId: String,
    var isOnline: Boolean = true,
    var session: DefaultWebSocketSession? = null,
    val joinedAt: Long = System.currentTimeMillis(),
    var handCards: MutableList<String> = mutableListOf(),
    var score: Int = 0
)

enum class RoomStatus { WAITING, PLAYING, FINISHED }

data class Room(
    val id: String,
    val name: String,
    var status: RoomStatus = RoomStatus.WAITING,
    var hostId: String,
    val maxPlayers: Int = 4,
    val players: MutableList<Player> = mutableListOf(),
    val createdAt: Long = System.currentTimeMillis()
)

data class GameState(
    val roomId: String,
    val deck: List<String>,
    val playersHand: Map<String, List<String>>,
    var currentTurn: String,
    var phase: String,
    var bidScore: Int,
    var diggerId: String?,
    var lastMove: Any?
)

// Service Logic
object GameServer {
    val rooms = ConcurrentHashMap<String, Room>()
    val games = ConcurrentHashMap<String, GameState>()
    val roomSessions = ConcurrentHashMap<String, MutableSet<DefaultWebSocketSession>>()

    suspend fun broadcast(roomId: String, message: String) {
        roomSessions[roomId]?.forEach { session ->
            try { session.send(message) } catch(e: Exception) {}
        }
    }

    fun createRoom(hostName: String, roomName: String, playerId: String? = null): Room {
        val roomId = UUID.randomUUID().toString()
        val hostId = playerId ?: UUID.randomUUID().toString()
        val hostPlayer = Player(id = hostId, name = hostName, roomId = roomId)
        val room = Room(id = roomId, name = roomName, hostId = hostPlayer.id)
        room.players.add(hostPlayer)
        rooms[roomId] = room
        return room
    }

    fun joinRoom(roomId: String, playerName: String, playerId: String? = null): Pair<Player, Room> {
        val room = rooms[roomId] ?: throw Exception("房间未找到")

        // Check if player is re-joining
        if (playerId != null) {
            val existingPlayer = room.players.find { it.id == playerId }
            if (existingPlayer != null) {
                existingPlayer.isOnline = true
                return Pair(existingPlayer, room)
            }
        }

        if (room.players.size >= room.maxPlayers) throw Exception("房间已满")
        if (room.status != RoomStatus.WAITING) throw Exception("游戏已开始")

        val newPlayerId = playerId ?: UUID.randomUUID().toString()
        val player = Player(id = newPlayerId, name = playerName, roomId = roomId)
        room.players.add(player)
        return Pair(player, room)
    }

    fun removePlayer(roomId: String, playerId: String): Pair<Boolean, String?> {
        val room = rooms[roomId] ?: return Pair(false, null)
        val wasHost = room.hostId == playerId
        room.players.removeIf { it.id == playerId }

        if (room.players.isEmpty()) {
            rooms.remove(roomId)
            return Pair(true, null)
        } else if (wasHost) {
            room.hostId = room.players[0].id
            return Pair(false, room.hostId)
        }
        return Pair(false, null)
    }
    
    suspend fun closeRoom(roomId: String, hostId: String) {
        val room = rooms[roomId] ?: throw Exception("房间未找到")
        if (room.hostId != hostId) throw Exception("只有房主可以解散房间")
        rooms.remove(roomId)
        broadcast(roomId, "{\"event\":\"room_closed\"}")
    }

    // Simplified Game Start Logic
    suspend fun startGame(roomId: String): GameState {
        val room = rooms[roomId] ?: throw Exception("房间未找到")
        if (room.players.size < 2) throw Exception("玩家人数不足") // Allow 2 for testing
        room.status = RoomStatus.PLAYING
        
        // Mock dealing cards
        val deck = mutableListOf<String>()
        val suits = listOf("H", "D", "C", "S")
        for (r in 3..15) { suits.forEach { s -> deck.add("$s$r") } }
        deck.add("JB"); deck.add("JR")
        deck.shuffle()
        
        val holeCards = deck.takeLast(6)
        val dealDeck = deck.dropLast(6)
        val cardsPerPlayer = dealDeck.size / room.players.size
        
        val playersHand = mutableMapOf<String, List<String>>()
        var idx = 0
        room.players.forEach { player ->
            val hand = dealDeck.subList(idx, idx + cardsPerPlayer).sortedByDescending { 
                it.substring(1).toIntOrNull() ?: 0 
            }
            playersHand[player.id] = hand
            player.handCards = hand.toMutableList()
            idx += cardsPerPlayer
        }

        val state = GameState(roomId, holeCards, playersHand, room.players[0].id, "BIDDING", 0, null, null)
        games[roomId] = state
        
        // Broadcast game started
        broadcast(roomId, "{\"event\":\"game_started\",\"data\":{\"roomId\":\"$roomId\"}}")
        
        return state
    }
}

class KtorService : Service() {
    private var server: NettyApplicationEngine? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startServer()
        return START_STICKY
    }

    override fun onDestroy() {
        server?.stop(1000, 2000)
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun startServer() {
        server = embeddedServer(Netty, port = 8080) {
            install(ContentNegotiation) { gson {} }
            install(CORS) { anyHost(); allowMethod(HttpMethod.Post); allowHeader(HttpHeaders.ContentType) }
            install(WebSockets) { pingPeriod = Duration.ofSeconds(15) }

            routing {
                // Static Files (Frontend)
                static("/") {
                    resources("assets")
                    defaultResource("assets/index.html")
                }

                // API Routes
                route("/api/room") {
                    get {
                        call.respond(mapOf("success" to true, "data" to GameServer.rooms.values))
                    }
                    
                    post("/create") {
                        try {
                            val params = call.receive<Map<String, String>>()
                            val playerName = params["playerName"]!!
                            val roomName = params["roomName"] ?: "${playerName}的房间"
                            val playerId = params["playerId"]
                            val room = GameServer.createRoom(playerName, roomName, playerId)
                            call.respond(mapOf("success" to true, "data" to mapOf("room" to room, "player" to room.players[0])))
                        } catch (e: Exception) {
                            call.respond(HttpStatusCode.InternalServerError, mapOf("success" to false, "error" to e.message))
                        }
                    }

                    post("/join") {
                        try {
                            val params = call.receive<Map<String, String>>()
                            val roomId = params["roomId"]!!
                            val playerName = params["playerName"]!!
                            val playerId = params["playerId"]
                            val result = GameServer.joinRoom(roomId, playerName, playerId)
                            call.respond(mapOf("success" to true, "data" to mapOf("player" to result.first, "room" to result.second)))
                        } catch (e: Exception) {
                            call.respond(HttpStatusCode.BadRequest, mapOf("success" to false, "error" to e.message))
                        }
                    }

                    get("/{roomId}") {
                        val roomId = call.parameters["roomId"]
                        val room = GameServer.rooms[roomId]
                        if (room != null) call.respond(mapOf("success" to true, "data" to room))
                        else call.respond(HttpStatusCode.NotFound, mapOf("success" to false, "error" to "房间未找到"))
                    }
                    
                    post("/start") {
                        try {
                             val params = call.receive<Map<String, String>>()
                             val roomId = params["roomId"]!!
                             GameServer.startGame(roomId)
                             call.respond(mapOf("success" to true, "data" to mapOf("status" to "started")))
                        } catch(e: Exception) {
                             call.respond(HttpStatusCode.InternalServerError, mapOf("success" to false, "error" to e.message))
                        }
                    }
                    
                    get("/{roomId}/game/{playerId}") {
                         val roomId = call.parameters["roomId"]!!
                         val playerId = call.parameters["playerId"]!!
                         val game = GameServer.games[roomId]
                         if (game != null) {
                             // Mask hand cards
                             val maskedState = mapOf(
                                 "roomId" to game.roomId,
                                 "myHand" to (game.playersHand[playerId]?.map { mapOf("code" to it) } ?: emptyList()),
                                 "otherPlayers" to game.playersHand.keys.filter { it != playerId }.map { id -> 
                                     mapOf("id" to id, "cardCount" to (game.playersHand[id]?.size ?: 0)) 
                                 },
                                 "currentTurn" to game.currentTurn,
                                 "phase" to game.phase
                             )
                             call.respond(mapOf("success" to true, "data" to maskedState))
                         } else {
                             call.respond(HttpStatusCode.NotFound, mapOf("success" to false, "error" to "游戏未找到"))
                         }
                    }
                    
                    post("/leave") {
                        try {
                            val params = call.receive<Map<String, String>>()
                            val roomId = params["roomId"]!!
                            val playerId = params["playerId"]!!
                            val result = GameServer.removePlayer(roomId, playerId)
                            call.respond(mapOf("success" to true, "data" to result))
                        } catch (e: Exception) {
                            call.respond(HttpStatusCode.InternalServerError, mapOf("success" to false, "error" to e.message))
                        }
                    }

                    post("/close") {
                        try {
                            val params = call.receive<Map<String, String>>()
                            val roomId = params["roomId"]!!
                            val playerId = params["playerId"]!!
                            GameServer.closeRoom(roomId, playerId)
                            call.respond(mapOf("success" to true, "data" to mapOf("closed" to true)))
                        } catch (e: Exception) {
                            call.respond(HttpStatusCode.InternalServerError, mapOf("success" to false, "error" to e.message))
                        }
                    }
                }

                // WebSocket
                webSocket("/ws") {
                    var currentRoomId: String? = null
                    try {
                        for (frame in incoming) {
                            if (frame is Frame.Text) {
                                val text = frame.readText()
                                try {
                                    val message = Gson().fromJson(text, Map::class.java)
                                    val event = message["event"] as? String
                                    val data = message["data"]
                                    
                                    if (event == "join_room" && data is String) {
                                        currentRoomId = data
                                        GameServer.roomSessions.computeIfAbsent(data) { 
                                            Collections.newSetFromMap(ConcurrentHashMap()) 
                                        }.add(this)
                                    }
                                } catch (e: Exception) {
                                    // Ignore invalid messages
                                }
                            }
                        }
                    } finally {
                        if (currentRoomId != null) {
                            GameServer.roomSessions[currentRoomId]?.remove(this)
                            if (GameServer.roomSessions[currentRoomId]?.isEmpty() == true) {
                                GameServer.roomSessions.remove(currentRoomId)
                            }
                        }
                    }
                }
            }
        }.start(wait = false)
    }
}
