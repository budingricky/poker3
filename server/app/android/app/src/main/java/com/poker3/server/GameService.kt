package com.poker3.server

import java.util.UUID

private data class HandPattern(val type: String, val rank: Int, val length: Int)

private fun getCompareValue(rank: Int): Int {
    return when (rank) {
        3 -> 13
        15 -> 12
        14 -> 11
        else -> rank - 4
    }
}

private fun isStraight(ranks: List<Int>): Boolean {
    if (ranks.size < 3) return false
    if (ranks.first() < 3) return false
    if (ranks.last() > 13) return false
    for (i in 0 until ranks.size - 1) {
        if (ranks[i + 1] != ranks[i] + 1) return false
    }
    return true
}

private fun isConsecutivePairs(ranks: List<Int>): Boolean {
    if (ranks.size < 6 || ranks.size % 2 != 0) return false
    if (ranks.first() < 3) return false
    if (ranks.last() > 13) return false
    for (i in ranks.indices step 2) {
        if (ranks[i] != ranks[i + 1]) return false
        if (i > 0 && ranks[i] != ranks[i - 2] + 1) return false
    }
    return true
}

private fun isConsecutiveTriplets(ranks: List<Int>): Boolean {
    if (ranks.size < 6 || ranks.size % 3 != 0) return false
    if (ranks.first() < 3) return false
    if (ranks.last() > 13) return false
    for (i in ranks.indices step 3) {
        if (!(ranks[i] == ranks[i + 1] && ranks[i + 1] == ranks[i + 2])) return false
        if (i > 0 && ranks[i] != ranks[i - 3] + 1) return false
    }
    return true
}

private fun analyzeHand(cards: List<Card>): HandPattern? {
    if (cards.isEmpty()) return null
    val sorted = cards.sortedBy { it.rank }
    val ranks = sorted.map { it.rank }
    val len = ranks.size

    if (len == 1) return HandPattern("SINGLE", ranks[0], 1)
    if (len == 2 && ranks[0] == ranks[1]) return HandPattern("PAIR", ranks[0], 2)
    if (len == 3 && ranks[0] == ranks[2]) return HandPattern("TRIPLET", ranks[0], 3)
    if (len == 4 && ranks[0] == ranks[3]) return HandPattern("QUAD", ranks[0], 4)

    if (len >= 3 && isStraight(ranks)) return HandPattern("STRAIGHT", ranks.last(), len)
    if (isConsecutivePairs(ranks)) return HandPattern("CONSECUTIVE_PAIRS", ranks.last(), len / 2)
    if (isConsecutiveTriplets(ranks)) return HandPattern("CONSECUTIVE_TRIPLETS", ranks.last(), len / 3)

    return null
}

private fun canBeat(current: List<Card>, last: List<Card>): Boolean {
    val curr = analyzeHand(current) ?: return false
    val prev = analyzeHand(last) ?: return false
    if (curr.type != prev.type) return false
    if (curr.length != prev.length) return false
    return getCompareValue(curr.rank) > getCompareValue(prev.rank)
}

object GameService {
    private val games = mutableMapOf<String, GameState>()
    private val lastWinnerByRoom = mutableMapOf<String, String>()
    private val nextRoundReadyByRoom = mutableMapOf<String, MutableSet<String>>()
    private data class UndoEntry(
        val playerId: String,
        val playedCards: List<Card>,
        val prevLastMove: Any?,
        val prevPassCount: Int
    )
    private val undoByRoom = mutableMapOf<String, UndoEntry>()

    fun startGame(roomId: String): GameState {
        val room = RoomService.getRoom(roomId) ?: throw Exception("房间未找到")
        if (room.players.size < 4) throw Exception("玩家人数不足")
        if (room.status != "WAITING") throw Exception("游戏已开始")

        games.remove(roomId)
        undoByRoom.remove(roomId)

        val deck = createDeck().toMutableList().also { it.shuffle() }
        val holeCardsCount = 4
        val cardsPerPlayer = (deck.size - holeCardsCount) / room.players.size

        val playersHand = mutableMapOf<String, MutableList<Card>>()
        var currentCardIndex = 0
        room.players.forEach { player ->
            val hand = deck.subList(currentCardIndex, currentCardIndex + cardsPerPlayer)
                .sortedWith(compareByDescending<Card> { getCompareValue(it.rank) }.thenByDescending { it.rank })
                .toMutableList()
            playersHand[player.id] = hand
            currentCardIndex += cardsPerPlayer
            player.handCards = hand.map { it.code }
        }

        val holeCards = deck.subList(currentCardIndex, deck.size).toMutableList()

        val lastWinnerId = lastWinnerByRoom[roomId]
        val biddingStarterId = if (lastWinnerId != null && room.players.any { it.id == lastWinnerId }) lastWinnerId else room.players[0].id

        room.status = "PLAYING"
        val gameState = GameState(
            roomId = roomId,
            deck = holeCards,
            playersHand = playersHand,
            currentTurn = biddingStarterId,
            phase = "BIDDING",
            bidScore = 0,
            diggerId = null,
            biddingStarterId = biddingStarterId,
            passCount = 0,
            lastMove = null
        )

        games[roomId] = gameState
        return gameState
    }

    fun handleBid(roomId: String, playerId: String, score: Int) {
        val game = games[roomId] ?: throw Exception("Game not found")
        if (game.phase != "BIDDING") throw Exception("Not in bidding phase")
        if (game.currentTurn != playerId) throw Exception("Not your turn")
        if (score !in listOf(0, 1, 2, 3, 4)) throw Exception("Invalid bid score")
        if (score > 0 && score <= game.bidScore) throw Exception("Must bid higher than current score")

        val hand = game.playersHand[playerId] ?: mutableListOf()
        if (isForcedBid(hand)) {
            game.bidScore = 4
            game.diggerId = playerId
            finalizeBidding(game)
            return
        }

        if (score > game.bidScore) {
            game.bidScore = score
            game.diggerId = playerId
        }

        if (score == 4) {
            finalizeBidding(game)
            return
        }

        val room = RoomService.getRoom(roomId) ?: return
        val currentIdx = room.players.indexOfFirst { it.id == playerId }
        val nextIdx = (currentIdx + 1) % room.players.size
        val nextId = room.players[nextIdx].id
        if (nextId == game.biddingStarterId) {
            if (game.diggerId == null) {
                game.diggerId = getLowestHeartPlayerId(game)
                game.bidScore = 1
            }
            finalizeBidding(game)
        } else {
            game.currentTurn = nextId
        }
    }

    private fun finalizeBidding(game: GameState) {
        if (game.diggerId == null) throw Exception("No digger selected")
        game.phase = "TAKING_HOLE"
        game.currentTurn = game.diggerId!!
        game.passCount = 0
        game.lastMove = null
    }

    fun takeHoleCards(roomId: String, playerId: String) {
        val game = games[roomId] ?: throw Exception("Game not found")
        if (game.phase != "TAKING_HOLE") throw Exception("Not in taking hole phase")
        if (game.diggerId != playerId) throw Exception("Only digger can take hole cards")

        val hole = game.deck.toList()
        if (hole.isNotEmpty()) {
            val hand = game.playersHand[playerId] ?: mutableListOf()
            hand.addAll(hole)
            hand.sortWith(compareByDescending<Card> { getCompareValue(it.rank) }.thenByDescending { it.rank })
            game.playersHand[playerId] = hand
        }
        game.deck.clear()
        game.phase = "PLAYING"
        game.passCount = 0
        game.lastMove = null
        game.currentTurn = findHeart4Owner(game)
    }

    fun handlePlayCards(roomId: String, playerId: String, cardCodes: List<String>) {
        val game = games[roomId] ?: throw Exception("Game not found")
        if (game.phase != "PLAYING") throw Exception("Not playing")
        if (game.currentTurn != playerId) throw Exception("Not your turn")

        val hand = game.playersHand[playerId] ?: mutableListOf()
        val cardsToPlay = hand.filter { cardCodes.contains(it.code) }
        
        if (cardsToPlay.size != cardCodes.size) throw Exception("Invalid cards")
        
        val pattern = analyzeHand(cardsToPlay) ?: throw Exception("Invalid pattern")
        
        if (game.lastMove != null) {
            val lastMoveData = game.lastMove as? Map<*, *> ?: throw Exception("Invalid last move")
            val lastPlayerId = lastMoveData["playerId"] as? String ?: throw Exception("Invalid last move")
            if (lastPlayerId != playerId) {
                @Suppress("UNCHECKED_CAST")
                val lastCards = lastMoveData["cards"] as? List<Card> ?: throw Exception("Invalid last move")
                if (!canBeat(cardsToPlay, lastCards)) throw Exception("Cards must be greater than last play")
            }
        }

        undoByRoom[roomId] = UndoEntry(
            playerId = playerId,
            playedCards = cardsToPlay.toList(),
            prevLastMove = game.lastMove,
            prevPassCount = game.passCount
        )
        
        val newHand = hand.filter { !cardCodes.contains(it.code) }.toMutableList()
        game.playersHand[playerId] = newHand
        
        game.lastMove = mapOf("playerId" to playerId, "cards" to cardsToPlay, "pattern" to mapOf("type" to pattern.type, "rank" to pattern.rank, "length" to pattern.length))
        game.passCount = 0

        if (newHand.isEmpty()) {
            undoByRoom.remove(roomId)
            game.phase = "FINISHED"
            val room = RoomService.getRoom(game.roomId)
            if (room != null) room.status = "FINISHED"
            lastWinnerByRoom[roomId] = playerId
            return
        }

        val isMax = isCurrentMoveMax(game, playerId, pattern)
        if (isMax) {
            game.currentTurn = playerId
            val lastMoveData = (game.lastMove as? Map<*, *>)?.toMutableMap() ?: mutableMapOf()
            lastMoveData["isMax"] = true
            game.lastMove = lastMoveData
        } else {
            nextTurn(game)
        }
    }

    fun handlePass(roomId: String, playerId: String) {
        val game = games[roomId] ?: throw Exception("Game not found")
        if (game.currentTurn != playerId) throw Exception("Not your turn")
        if (game.phase != "PLAYING") throw Exception("Not playing")
        undoByRoom.remove(roomId)
        if (game.lastMove == null) throw Exception("Cannot pass when you have free play")
        val lastPlayerId = ((game.lastMove as? Map<*, *>)?.get("playerId") as? String)
            ?: throw Exception("Invalid last move")
        if (lastPlayerId == playerId) throw Exception("Cannot pass when you have free play")

        game.passCount += 1
        nextTurn(game)

        val room = RoomService.getRoom(game.roomId)
        if (room != null && game.lastMove != null && game.passCount >= room.players.size - 1) {
            val lastPid = ((game.lastMove as? Map<*, *>)?.get("playerId") as? String)
                ?: throw Exception("Invalid last move")
            game.currentTurn = lastPid
            game.lastMove = null
            game.passCount = 0
        }
    }

    private fun nextTurn(game: GameState) {
        val room = RoomService.getRoom(game.roomId) ?: return
        val currentIdx = room.players.indexOfFirst { it.id == game.currentTurn }
        val nextIdx = (currentIdx + 1) % room.players.size
        game.currentTurn = room.players[nextIdx].id
    }

    fun getGameState(roomId: String, playerId: String): Map<String, Any?>? {
        val game = games[roomId] ?: return null
        val room = RoomService.getRoom(roomId)
        return mapOf(
            "roomId" to game.roomId,
            "hostId" to room?.hostId,
            "myHand" to (game.playersHand[playerId] ?: mutableListOf()),
            "otherPlayers" to game.playersHand.keys.filter { it != playerId }.map { id ->
                val p = room?.players?.find { it.id == id }
                mapOf("id" to id, "name" to (p?.name ?: "Unknown"), "cardCount" to (game.playersHand[id]?.size ?: 0))
            },
            "currentTurn" to game.currentTurn,
            "phase" to game.phase,
            "passCount" to game.passCount,
            "bidScore" to game.bidScore,
            "diggerId" to game.diggerId,
            "lastMove" to game.lastMove,
            "holeCards" to if (game.phase == "TAKING_HOLE") game.deck else emptyList<Card>(),
            "nextRoundReady" to if (room?.status == "FINISHED") (nextRoundReadyByRoom[roomId]?.toList() ?: emptyList<String>()) else emptyList<String>()
        )
    }

    fun undoLastMove(roomId: String, playerId: String) {
        val game = games[roomId] ?: throw Exception("Game not found")
        if (game.phase != "PLAYING") throw Exception("Not playing")
        val lastPlayerId = ((game.lastMove as? Map<*, *>)?.get("playerId") as? String)
        if (lastPlayerId != playerId) throw Exception("No undoable move")
        if (game.passCount != 0) throw Exception("Cannot undo after others acted")

        val undo = undoByRoom[roomId] ?: throw Exception("No undoable move")
        if (undo.playerId != playerId) throw Exception("No undoable move")

        val hand = game.playersHand[playerId] ?: mutableListOf()
        val merged = (hand + undo.playedCards).toMutableList()
        merged.sortWith(compareByDescending<Card> { getCompareValue(it.rank) }.thenByDescending { it.rank })
        game.playersHand[playerId] = merged
        game.lastMove = undo.prevLastMove
        game.passCount = undo.prevPassCount
        game.currentTurn = playerId
        undoByRoom.remove(roomId)
    }

    fun markNextRoundReady(roomId: String, playerId: String): Boolean {
        val room = RoomService.getRoom(roomId) ?: throw Exception("房间未找到")
        if (room.status != "FINISHED") throw Exception("当前不在结算阶段")
        if (!room.players.any { it.id == playerId }) throw Exception("玩家不在房间内")
        val set = nextRoundReadyByRoom.getOrPut(roomId) { mutableSetOf() }
        set.add(playerId)
        if (set.size >= room.players.size) {
            restartGame(roomId)
            return true
        }
        return false
    }

    fun restartGame(roomId: String) {
        val room = RoomService.getRoom(roomId) ?: throw Exception("房间未找到")
        if (room.players.size < 4) throw Exception("玩家人数不足")
        room.status = "WAITING"
        nextRoundReadyByRoom.remove(roomId)
        undoByRoom.remove(roomId)
        startGame(roomId)
    }

    fun handlePlayerLeft(roomId: String, playerId: String) {
        val set = nextRoundReadyByRoom[roomId]
        if (set != null) {
            set.remove(playerId)
            if (set.isEmpty()) nextRoundReadyByRoom.remove(roomId)
        }
        val undo = undoByRoom[roomId]
        if (undo?.playerId == playerId) undoByRoom.remove(roomId)
    }

    fun handleRoomDeleted(roomId: String) {
        games.remove(roomId)
        nextRoundReadyByRoom.remove(roomId)
        undoByRoom.remove(roomId)
    }

    private fun isCurrentMoveMax(game: GameState, playerId: String, pattern: HandPattern): Boolean {
        val others = game.playersHand.keys.filter { it != playerId }
        for (pid in others) {
            val hand = game.playersHand[pid] ?: mutableListOf()
            if (canAnyBeat(hand, pattern)) return false
        }
        return true
    }

    private fun canAnyBeat(hand: List<Card>, pattern: HandPattern): Boolean {
        val lastRankValue = getCompareValue(pattern.rank)
        val counts = mutableMapOf<Int, Int>()
        hand.forEach { c -> counts[c.rank] = (counts[c.rank] ?: 0) + 1 }

        fun hasSingleAbove(): Boolean {
            var best = Int.MIN_VALUE
            counts.keys.forEach { r -> best = maxOf(best, getCompareValue(r)) }
            return best > lastRankValue
        }

        fun hasOfKindAbove(need: Int): Boolean {
            counts.forEach { (rank, cnt) ->
                if (cnt >= need && getCompareValue(rank) > lastRankValue) return true
            }
            return false
        }

        fun hasStraightAbove(len: Int, needCountPerRank: Int): Boolean {
            val minRank = 3
            val maxRank = 13
            for (start in minRank..(maxRank - len + 1)) {
                val end = start + len - 1
                if (end <= pattern.rank) continue
                var ok = true
                for (r in start..end) {
                    if ((counts[r] ?: 0) < needCountPerRank) {
                        ok = false
                        break
                    }
                }
                if (ok) return true
            }
            return false
        }

        return when (pattern.type) {
            "SINGLE" -> hasSingleAbove()
            "PAIR" -> hasOfKindAbove(2)
            "TRIPLET" -> hasOfKindAbove(3)
            "QUAD" -> hasOfKindAbove(4)
            "STRAIGHT" -> hasStraightAbove(pattern.length, 1)
            "CONSECUTIVE_PAIRS" -> hasStraightAbove(pattern.length, 2)
            "CONSECUTIVE_TRIPLETS" -> hasStraightAbove(pattern.length, 3)
            else -> false
        }
    }

    private fun createDeck(): List<Card> {
        val deck = mutableListOf<Card>()
        val suits = listOf("H", "D", "C", "S") // Hearts, Diamonds, Clubs, Spades
        
        for (rank in 3..15) {
            for (suit in suits) {
                deck.add(Card(suit, rank, "$suit$rank"))
            }
        }
        return deck
    }

    private fun isForcedBid(hand: List<Card>): Boolean {
        val count3 = hand.count { it.rank == 3 }
        val hasHeart4 = hand.any { it.suit == "H" && it.rank == 4 }
        if (count3 >= 3) return true
        if (count3 >= 2 && hasHeart4) return true
        return false
    }

    private fun getLowestHeartPlayerId(game: GameState): String {
        var bestPid: String = game.playersHand.keys.firstOrNull() ?: UUID.randomUUID().toString()
        var bestValue = Int.MAX_VALUE
        game.playersHand.forEach { (pid, hand) ->
            hand.forEach cardLoop@{ c ->
                if (c.suit != "H") return@cardLoop
                val v = getCompareValue(c.rank)
                if (v < bestValue) {
                    bestValue = v
                    bestPid = pid
                }
            }
        }
        return bestPid
    }

    private fun findHeart4Owner(game: GameState): String {
        game.playersHand.forEach { (pid, hand) ->
            if (hand.any { it.suit == "H" && it.rank == 4 }) return pid
        }
        return game.currentTurn
    }

    fun getWinnerSide(roomId: String, winnerId: String): String? {
        val game = games[roomId] ?: return null
        return if (game.diggerId == winnerId) "DIGGER" else "OTHERS"
    }
}
