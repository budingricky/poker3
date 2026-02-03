package com.poker3.server

import java.util.Collections

// Game Logic Helpers (Can be extracted to separate object if needed)
fun getCardRank(card: Card): Int = card.rank

fun analyzeHand(cards: List<Card>): Triple<String, Int, Int>? {
    if (cards.isEmpty()) return null
    
    val sorted = cards.sortedBy { it.rank }
    val len = sorted.size
    val ranks = sorted.map { it.rank }
    
    // Rocket (Double Joker)
    if (len == 2 && ranks[0] == 16 && ranks[1] == 17) {
        return Triple("ROCKET", 17, 2)
    }

    // Bomb (4 cards same rank)
    if (len == 4 && ranks[0] == ranks[3]) {
        return Triple("BOMB", ranks[0], 4)
    }

    // Single
    if (len == 1) return Triple("SINGLE", ranks[0], 1)

    // Pair
    if (len == 2 && ranks[0] == ranks[1]) return Triple("PAIR", ranks[0], 2)

    // Triplet
    if (len == 3 && ranks[0] == ranks[2]) return Triple("TRIPLET", ranks[0], 3)

    // Triplet + Single
    if (len == 4) {
        if (ranks[0] == ranks[2] && ranks[0] != ranks[3]) return Triple("TRIPLET_WITH_SINGLE", ranks[0], 4)
        if (ranks[1] == ranks[3] && ranks[0] != ranks[1]) return Triple("TRIPLET_WITH_SINGLE", ranks[1], 4)
    }

    // Straight
    if (len >= 5 && isStraight(ranks)) {
        return Triple("STRAIGHT", ranks[0], len)
    }

    // Consecutive Pairs
    if (len >= 4 && len % 2 == 0 && isConsecutivePairs(ranks)) {
        return Triple("CONSECUTIVE_PAIRS", ranks[0], len / 2)
    }

    return null
}

fun isStraight(ranks: List<Int>): Boolean {
    if (ranks.last() > 14) return false
    for (i in 0 until ranks.size - 1) {
        if (ranks[i+1] != ranks[i] + 1) return false
    }
    return true
}

fun isConsecutivePairs(ranks: List<Int>): Boolean {
    if (ranks.last() > 14) return false
    for (i in 0 until ranks.size step 2) {
        if (ranks[i] != ranks[i+1]) return false
        if (i > 0 && ranks[i] != ranks[i-2] + 1) return false
    }
    return true
}

fun canBeat(current: List<Card>, last: List<Card>): Boolean {
    val currPattern = analyzeHand(current)
    val lastPattern = analyzeHand(last)
    
    if (currPattern == null || lastPattern == null) return false
    
    val (currType, currRank, currLen) = currPattern
    val (lastType, lastRank, lastLen) = lastPattern

    // Rocket beats everything
    if (currType == "ROCKET") return true
    if (lastType == "ROCKET") return false

    // Bomb beats everything except higher bomb and Rocket
    if (currType == "BOMB") {
        if (lastType != "BOMB") return true
        return currRank > lastRank
    }

    if (currType != lastType) return false
    
    // For Straight/Consecutive Pairs/Triplet+1, length must match (usually)
    // Actually Triplet+1 is fixed length 4, but Straight length matters.
    if (currType == "STRAIGHT" && currLen != lastLen) return false
    if (currType == "CONSECUTIVE_PAIRS" && currLen != lastLen) return false
    
    // Triplet+1 length is always 4, so no need to check if types match.

    return currRank > lastRank
}

object GameService {
    private val games = mutableMapOf<String, GameState>()

    fun startGame(roomId: String): GameState {
        // ... (existing code)
        val room = RoomService.getRoom(roomId) ?: throw Exception("房间未找到")
        // ...
        
        // Ensure to clear old state?
        games.remove(roomId)
        
        // ... (deck creation)
        var deck = createDeck()
        deck = deck.shuffled()

        val holeCardsCount = 6
        val cardsPerPlayer = (deck.size - holeCardsCount) / room.players.size
        
        val playersHand = mutableMapOf<String, List<Card>>()
        var currentCardIndex = 0

        room.players.forEach { player ->
            val hand = deck.subList(currentCardIndex, currentCardIndex + cardsPerPlayer)
                .sortedByDescending { it.rank }
            playersHand[player.id] = hand
            currentCardIndex += cardsPerPlayer
            player.handCards = hand.map { it.code }
        }

        val holeCards = deck.subList(currentCardIndex, deck.size)

        val gameState = GameState(
            roomId = roomId,
            deck = holeCards,
            playersHand = playersHand,
            currentTurn = room.players[0].id,
            phase = "BIDDING"
        )

        games[roomId] = gameState
        return gameState
    }

    fun handleBid(roomId: String, playerId: String, score: Int) {
        val game = games[roomId] ?: throw Exception("Game not found")
        if (game.phase != "BIDDING") throw Exception("Not in bidding phase")
        if (game.currentTurn != playerId) throw Exception("Not your turn")

        if (score > 0 && score <= game.bidScore) throw Exception("Must bid higher")
        
        if (score > game.bidScore) {
            game.bidScore = score
            game.diggerId = playerId
        }

        if (score == 3) {
            finalizeBidding(game)
            return
        }

        val room = RoomService.getRoom(roomId) ?: return
        val currentIdx = room.players.indexOfFirst { it.id == playerId }
        val nextIdx = (currentIdx + 1) % room.players.size
        
        if (nextIdx == 0) { // Host started, so if next is 0, round ends
             if (game.diggerId == null) {
                 game.diggerId = room.players[0].id
                 game.bidScore = 1
             }
             finalizeBidding(game)
        } else {
            game.currentTurn = room.players[nextIdx].id
            // Broadcast update handled by controller
        }
    }

    private fun finalizeBidding(game: GameState) {
        game.phase = "PLAYING"
        game.currentTurn = game.diggerId!!
        
        // Add hole cards
        val hand = game.playersHand[game.diggerId]!!.toMutableList()
        hand.addAll(game.deck)
        // Re-sort
        val newHand = hand.sortedByDescending { it.rank }
        // Update map - Kotlin map is immutable? GameState.playersHand is Map (read-only interface) but we need to update it.
        // Wait, GameState data class has `val playersHand`. We need to make it mutable or copy.
        // Let's assume we can cast or change model.
        // Actually best to change Model to MutableMap or var.
        (game.playersHand as MutableMap)[game.diggerId!!] = newHand
    }

    fun handlePlayCards(roomId: String, playerId: String, cardCodes: List<String>) {
        val game = games[roomId] ?: throw Exception("Game not found")
        if (game.phase != "PLAYING") throw Exception("Not playing")
        if (game.currentTurn != playerId) throw Exception("Not your turn")

        val hand = game.playersHand[playerId] ?: emptyList()
        val cardsToPlay = hand.filter { cardCodes.contains(it.code) }
        
        if (cardsToPlay.size != cardCodes.size) throw Exception("Invalid cards")
        
        // Logic check
        val pattern = analyzeHand(cardsToPlay) ?: throw Exception("Invalid pattern")
        
        // Check against last move
        if (game.lastMove != null) {
            val lastMoveData = game.lastMove as Map<String, Any>
            val lastPlayerId = lastMoveData["playerId"] as String
            if (lastPlayerId != playerId) {
                // Find last cards
                // Since lastMove stores simple map, we need to reconstruct cards or store Card objects
                // In simplify, assume we can pass Card objects or we reconstruct them from list of codes
                // BUT `game.lastMove` in Kotlin code stores `cards` as `List<Card>` (see handlePlayCards below)
                // Wait, below: `game.lastMove = mapOf("playerId" to playerId, "cards" to cardsToPlay)`
                // cardsToPlay is List<Card>. So we can cast.
                val lastCards = lastMoveData["cards"] as List<Card>
                if (!canBeat(cardsToPlay, lastCards)) {
                     throw Exception("Cards must be greater than last play")
                }
            }
        }
        
        // Remove cards
        val newHand = hand.filter { !cardCodes.contains(it.code) }
        (game.playersHand as MutableMap)[playerId] = newHand
        
        // Update last move
        game.lastMove = mapOf("playerId" to playerId, "cards" to cardsToPlay)

        if (newHand.isEmpty()) {
            game.phase = "FINISHED"
            // Broadcast game over
            return
        }

        nextTurn(game)
    }

    fun handlePass(roomId: String, playerId: String) {
        val game = games[roomId] ?: throw Exception("Game not found")
        if (game.currentTurn != playerId) throw Exception("Not your turn")
        nextTurn(game)
    }

    private fun nextTurn(game: GameState) {
        val room = RoomService.getRoom(game.roomId) ?: return
        val currentIdx = room.players.indexOfFirst { it.id == game.currentTurn }
        val nextIdx = (currentIdx + 1) % room.players.size
        game.currentTurn = room.players[nextIdx].id
    }

    // ... getGameState ...

    fun getGameState(roomId: String, playerId: String): Map<String, Any>? {
        val game = games[roomId] ?: return null
        
        // Return masked state similar to Node.js backend
        return mapOf(
            "roomId" to game.roomId,
            "myHand" to (game.playersHand[playerId] ?: emptyList()),
            "otherPlayers" to game.playersHand.keys.filter { it != playerId }.map { id ->
                mapOf("id" to id, "cardCount" to (game.playersHand[id]?.size ?: 0))
            },
            "currentTurn" to game.currentTurn,
            "phase" to game.phase,
            "bidScore" to game.bidScore,
            "diggerId" to game.diggerId,
            "lastMove" to game.lastMove
        )
    }

    private fun createDeck(): List<Card> {
        val deck = mutableListOf<Card>()
        val suits = listOf("H", "D", "C", "S") // Hearts, Diamonds, Clubs, Spades
        
        // 3 to 2 (Rank 3-15)
        for (rank in 3..15) {
            for (suit in suits) {
                deck.add(Card(suit, rank, "$suit$rank"))
            }
        }
        
        // Jokers
        deck.add(Card("J", 16, "JB")) // Black Joker
        deck.add(Card("J", 17, "JR")) // Red Joker
        
        return deck
    }
}
