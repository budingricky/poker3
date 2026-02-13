package com.poker3.server

data class Room(
    val id: String,
    var name: String,
    var status: String = "WAITING",
    var hostId: String,
    val maxPlayers: Int = 4,
    var players: MutableList<Player> = mutableListOf(),
    val createdAt: Long = System.currentTimeMillis()
)

data class Player(
    val id: String,
    var name: String,
    val roomId: String,
    var isOnline: Boolean = true,
    var socketId: String? = null,
    val joinedAt: Long = System.currentTimeMillis(),
    var handCards: List<String> = emptyList(), // Store card codes
    var score: Int = 0
)

data class GameState(
    val roomId: String,
    var deck: MutableList<Card>, // Hole cards (only visible in TAKING_HOLE)
    var playersHand: MutableMap<String, MutableList<Card>>,
    var currentTurn: String,
    var phase: String, // BIDDING, TAKING_HOLE, PLAYING, FINISHED
    var bidScore: Int = 0,
    var diggerId: String? = null,
    var biddingStarterId: String,
    var passCount: Int = 0,
    var lastMove: Any? = null
)

data class Card(
    val suit: String,
    val rank: Int,
    val code: String
)

data class CreateRoomRequest(val playerName: String, val roomName: String?, val playerId: String? = null)
data class JoinRoomRequest(val roomId: String, val playerName: String, val playerId: String? = null)
data class LeaveRoomRequest(val roomId: String, val playerId: String)
data class PlayCardsRequest(val roomId: String, val playerId: String, val cards: List<String>)
data class PassRequest(val roomId: String, val playerId: String)
data class BidRequest(val roomId: String, val playerId: String, val score: Int)
data class StartGameRequest(val roomId: String)
data class TakeHoleRequest(val roomId: String, val playerId: String)

data class ApiResponse<T>(val success: Boolean, val data: T? = null, val error: String? = null)
