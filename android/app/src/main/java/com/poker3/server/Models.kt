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
    val deck: List<Card>, // Hole cards
    val playersHand: Map<String, List<Card>>,
    var currentTurn: String,
    var phase: String, // DEALING, BIDDING, PLAYING, SCORING, FINISHED
    var bidScore: Int = 0,
    var diggerId: String? = null,
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

data class ApiResponse<T>(val success: Boolean, val data: T? = null, val error: String? = null)
