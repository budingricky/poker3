package com.poker3.server

import java.util.UUID

object RoomService {
    private val rooms = mutableMapOf<String, Room>()

    fun createRoom(hostName: String, roomName: String, playerId: String? = null): Room {
        val roomId = UUID.randomUUID().toString()
        val actualHost = Player(
            id = playerId ?: UUID.randomUUID().toString(),
            name = hostName,
            roomId = roomId,
            isOnline = true
        )

        val newRoom = Room(
            id = roomId,
            name = roomName,
            hostId = actualHost.id,
            players = mutableListOf(actualHost)
        )

        rooms[roomId] = newRoom
        return newRoom
    }

    fun joinRoom(roomId: String, playerName: String, playerId: String? = null): Pair<Player, Room> {
        val room = rooms[roomId] ?: throw Exception("房间未找到")
        
        // Re-join logic
        if (playerId != null) {
            val existingPlayer = room.players.find { it.id == playerId }
            if (existingPlayer != null) {
                existingPlayer.isOnline = true
                // Update name? Optional.
                // existingPlayer.name = playerName
                return Pair(existingPlayer, room)
            }
        }

        if (room.players.size >= room.maxPlayers) throw Exception("房间已满")
        if (room.status == "PLAYING") throw Exception("游戏进行中，暂不可加入")

        val newPlayer = Player(
            id = UUID.randomUUID().toString(),
            name = playerName,
            roomId = roomId
        )

        room.players.add(newPlayer)
        return Pair(newPlayer, room)
    }

    fun removePlayer(roomId: String, playerId: String): Pair<Boolean, String?> {
        val room = rooms[roomId] ?: return Pair(false, null)
        
        val wasHost = room.hostId == playerId
        room.players.removeIf { it.id == playerId }

        if (room.players.isEmpty()) {
            rooms.remove(roomId)
            return Pair(true, null)
        } else if (wasHost) {
            // Assign new host
            room.hostId = room.players[0].id
            return Pair(false, room.hostId)
        }
        
        return Pair(false, null)
    }

    fun closeRoom(roomId: String, hostId: String) {
        val room = rooms[roomId] ?: throw Exception("房间未找到")
        if (room.hostId != hostId) throw Exception("只有房主可以解散房间")
        rooms.remove(roomId)
    }

    fun getRoom(roomId: String): Room? = rooms[roomId]

    fun getAllRooms(): List<Room> = rooms.values.toList()
}
