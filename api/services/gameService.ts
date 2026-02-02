import { Card, Suit, GameState } from '../models/gameTypes.js';
import { Room, Player, RoomStatus } from '../models/types.js';
import { roomService } from './roomService.js';
import { io } from '../server.js';

class GameService {
  private games: Map<string, GameState> = new Map();

  createDeck(): Card[] {
    const deck: Card[] = [];
    const suits = [Suit.HEARTS, Suit.DIAMONDS, Suit.CLUBS, Suit.SPADES];
    
    // 3 to A, 2 (Rank 3-15)
    for (let rank = 3; rank <= 15; rank++) {
      for (const suit of suits) {
        deck.push({
          suit,
          rank,
          code: `${suit}${rank}`
        });
      }
    }

    // Jokers
    deck.push({ suit: Suit.JOKER, rank: 16, code: 'JB' });
    deck.push({ suit: Suit.JOKER, rank: 17, code: 'JR' });

    return deck;
  }

  shuffle(deck: Card[]): Card[] {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  startGame(roomId: string): GameState {
    const room = roomService.getRoom(roomId);
    if (!room) throw new Error('Room not found');
    if (room.players.length < 2) throw new Error('Not enough players'); // Allow 2 for testing

    room.status = RoomStatus.PLAYING;

    // Create and shuffle deck
    let deck = this.createDeck();
    deck = this.shuffle(deck);

    // Deal cards (Keep 6 for the "hole")
    const holeCardsCount = 6;
    const cardsPerPlayer = (deck.length - holeCardsCount) / room.players.length;
    
    const playersHand: { [playerId: string]: Card[] } = {};
    let currentCardIndex = 0;

    room.players.forEach(player => {
      const hand = deck.slice(currentCardIndex, currentCardIndex + cardsPerPlayer);
      playersHand[player.id] = hand.sort((a, b) => b.rank - a.rank); // Sort by rank desc
      currentCardIndex += cardsPerPlayer;
      
      // Update player object in room service (optional, but good for persistence)
      player.handCards = hand.map(c => c.code);
    });

    const holeCards = deck.slice(currentCardIndex);

    const gameState: GameState = {
      roomId,
      deck: holeCards, // These are the hole cards
      playersHand,
      currentTurn: room.players[0].id, // Host starts bidding
      phase: 'BIDDING',
      bidScore: 0,
      diggerId: null,
      lastMove: null
    };

    this.games.set(roomId, gameState);

    // Notify all players via Socket.io
    io.to(roomId).emit('game_started', {
      roomId,
      // Don't send everyone's hand to everyone!
    });

    // Send individual hands
    room.players.forEach(player => {
        const socketId = this.getSocketIdForPlayer(player.id); 
        // Note: socketId mapping needs to be maintained. 
        // For now, we rely on client requesting game state or broadcasting carefully.
        // Actually, we should emit to specific socket if possible.
        // But since we don't track socketId reliably in RoomService yet (it's optional), 
        // we will send a "fetch_game_state" event and let client pull data.
    });

    return gameState;
  }

  getGameState(roomId: string, playerId: string): any {
    const game = this.games.get(roomId);
    if (!game) return null;

    // Return masked state
    return {
      roomId: game.roomId,
      myHand: game.playersHand[playerId] || [],
      otherPlayers: Object.keys(game.playersHand).filter(id => id !== playerId).map(id => ({
        id,
        cardCount: game.playersHand[id].length
      })),
      currentTurn: game.currentTurn,
      phase: game.phase,
      bidScore: game.bidScore,
      diggerId: game.diggerId,
      lastMove: game.lastMove
    };
  }

  // Helper (stub)
  private getSocketIdForPlayer(playerId: string): string | undefined {
      // This requires RoomService to track socketIds strictly
      return undefined;
  }
}

export const gameService = new GameService();
