import { Card, Suit, GameState } from '../models/gameTypes.js';
import { Room, Player, RoomStatus } from '../models/types.js';
import { roomService } from './roomService.js';
import { socketService } from './socketService.js';
import { analyzeHand, canBeat, sortCards, getCompareValue } from './gameLogic.js';

class GameService {
  private games: Map<string, GameState> = new Map();
  private lastWinnerByRoom: Map<string, string> = new Map();

  // ... (createDeck and shuffle methods remain same)
  createDeck(): Card[] {
    const deck: Card[] = [];
    const suits = [Suit.HEARTS, Suit.DIAMONDS, Suit.CLUBS, Suit.SPADES];
    
    for (let rank = 3; rank <= 15; rank++) {
      for (const suit of suits) {
        deck.push({
          suit,
          rank,
          code: `${suit}${rank}`
        });
      }
    }

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
    if (!room) throw new Error('房间未找到');
    if (room.players.length < 4) throw new Error('玩家人数不足');
    if (room.status !== RoomStatus.WAITING) throw new Error('游戏已开始');
    if (this.games.has(roomId)) throw new Error('游戏已开始');

    room.status = RoomStatus.PLAYING;

    // Create and shuffle deck
    let deck = this.createDeck();
    deck = this.shuffle(deck);

    // Deal cards (Keep 4 for the "hole" in standard 4-player Waken, or 6?
    // Rules say: 54 cards, 4 players. 
    // Usually 54 / 4 = 13...2.
    // Standard Waken (Shaanxi): 4 players. 
    // Deck: 54 cards.
    // Each player: ? 
    // Actually standard Waken is usually 3 players (1 vs 2).
    // But user asked for "4人纸牌".
    // 4-player Waken variation:
    // Option A: 2 decks? No, user said "one deck".
    // If 1 deck (54 cards):
    // 54 - 6 = 48. 48 / 4 = 12 cards each. 6 hole cards.
    // This matches our previous logic.
    const holeCardsCount = 4;
    const cardsPerPlayer = (deck.length - holeCardsCount) / room.players.length;
    
    const playersHand: { [playerId: string]: Card[] } = {};
    let currentCardIndex = 0;

    room.players.forEach(player => {
      const hand = deck.slice(currentCardIndex, currentCardIndex + cardsPerPlayer);
      playersHand[player.id] = sortCards(hand); // Sort by rank desc
      currentCardIndex += cardsPerPlayer;
      player.handCards = hand.map(c => c.code);
    });

    const holeCards = deck.slice(currentCardIndex);

    const lastWinnerId = this.lastWinnerByRoom.get(roomId);
    const biddingStarterId = lastWinnerId && room.players.some(p => p.id === lastWinnerId) ? lastWinnerId : room.players[0].id;

    const gameState: GameState = {
      roomId,
      deck: holeCards, // These are the hole cards
      playersHand,
      currentTurn: biddingStarterId,
      phase: 'BIDDING',
      bidScore: 0,
      diggerId: null,
      biddingStarterId,
      passCount: 0,
      lastMove: null
    };

    this.games.set(roomId, gameState);

    // Notify all players via WebSocket
    socketService.broadcast(roomId, 'game_started', { roomId });
    socketService.broadcast(roomId, 'room_update');

    return gameState;
  }

  // Player calls score (1, 2, 3)
  // If score > currentBid, they become candidate.
  // If score == 3, bidding ends immediately.
  // If all pass, redeal? Or forced? Let's assume simple logic: Host starts.
  // We need to track who has bid.
  // Simplified logic:
  // Players bid in order. If someone bids 3, they win.
  // If everyone passes, the first player (Host) is forced to be Digger at 1 point (or redeal).
  // Let's implement:
  // - currentTurn tracks who is bidding.
  // - bidScore tracks max bid.
  // - diggerId tracks temporary winner.
  
  handleBid(roomId: string, playerId: string, score: number) {
      const game = this.games.get(roomId);
      if (!game) throw new Error('Game not found');
      if (game.phase !== 'BIDDING') throw new Error('Not in bidding phase');
      if (game.currentTurn !== playerId) throw new Error('Not your turn');

      if (![0, 1, 2, 3, 4].includes(score)) throw new Error('Invalid bid score');
      if (score > 0 && score <= game.bidScore) throw new Error('Must bid higher than current score');

      const hand = game.playersHand[playerId] || [];
      if (this.isForcedBid(hand)) {
          game.bidScore = 4;
          game.diggerId = playerId;
          this.finalizeBidding(game);
          return;
      }

      if (score > game.bidScore) {
          game.bidScore = score;
          game.diggerId = playerId;
      }

      if (score === 4) {
          this.finalizeBidding(game);
          return;
      }

      // Move to next player
      const room = roomService.getRoom(roomId);
      if (!room) return;
      
      const currentPlayerIndex = room.players.findIndex(p => p.id === playerId);
      const nextPlayerIndex = (currentPlayerIndex + 1) % room.players.length;
      
      if (room.players[nextPlayerIndex].id === game.biddingStarterId) {
          if (game.diggerId === null) {
              game.diggerId = this.getLowestHeartPlayerId(game);
              game.bidScore = 1;
          }
          this.finalizeBidding(game);
      } else {
          game.currentTurn = room.players[nextPlayerIndex].id;
          socketService.broadcast(roomId, 'game_update');
      }
  }

  private finalizeBidding(game: GameState) {
      if (!game.diggerId) throw new Error('No digger selected');
      game.phase = 'TAKING_HOLE';
      game.passCount = 0;
      game.lastMove = null;
      game.currentTurn = game.diggerId;

      socketService.broadcast(game.roomId, 'hole_revealed', { holeCards: game.deck });
      socketService.broadcast(game.roomId, 'game_update');
  }

  takeHoleCards(roomId: string, playerId: string) {
      const game = this.games.get(roomId);
      if (!game) throw new Error('Game not found');
      if (game.phase !== 'TAKING_HOLE') throw new Error('Not in taking hole phase');
      if (!game.diggerId || game.diggerId !== playerId) throw new Error('Only digger can take hole cards');

      const hole = game.deck || [];
      if (hole.length > 0) {
          const hand = game.playersHand[playerId] || [];
          hand.push(...hole);
          game.playersHand[playerId] = sortCards(hand);
      }
      game.deck = [];

      game.phase = 'PLAYING';
      game.passCount = 0;
      game.lastMove = null;
      game.currentTurn = this.findHeart4Owner(game);

      socketService.broadcast(game.roomId, 'hole_taken', { diggerId: playerId });
      socketService.broadcast(game.roomId, 'game_update');
  }

  handlePlayCards(roomId: string, playerId: string, cardCodes: string[]) {
      const game = this.games.get(roomId);
      if (!game) throw new Error('Game not found');
      if (game.phase !== 'PLAYING') throw new Error('Not in playing phase');
      if (game.currentTurn !== playerId) throw new Error('Not your turn');

      const hand = game.playersHand[playerId];
      const cardsToPlay = hand.filter(c => cardCodes.includes(c.code));
      
      if (cardsToPlay.length !== cardCodes.length) throw new Error('Invalid cards');

      // Analyze pattern
      const pattern = analyzeHand(cardsToPlay);
      if (!pattern) throw new Error('Invalid card pattern');

      // Check against last move
      if (game.lastMove && game.lastMove.playerId !== playerId) {
          // If last move was NOT by me (i.e. I am following), I must beat it.
          // Note: If last move was by me, it means everyone else passed, so I can play anything.
          // Wait, we need to track who played the last VALID move.
          // game.lastMove should store { playerId, cards, pattern }
          
          if (!canBeat(cardsToPlay, game.lastMove.cards)) {
              throw new Error('Cards must be greater than last play');
          }
      }

      // Valid play
      // Remove cards from hand
      game.playersHand[playerId] = hand.filter(c => !cardCodes.includes(c.code));
      
      // Update last move
      game.lastMove = {
          playerId,
          cards: cardsToPlay,
          pattern
      };
      game.passCount = 0;

      // Check win
      if (game.playersHand[playerId].length === 0) {
          game.phase = 'FINISHED';
          const room = roomService.getRoom(game.roomId);
          if (room) room.status = RoomStatus.FINISHED;
          this.lastWinnerByRoom.set(roomId, playerId);
          const winnerSide = game.diggerId === playerId ? 'DIGGER' : 'OTHERS';
          socketService.broadcast(game.roomId, 'game_over', { winnerId: playerId, winnerSide });
          socketService.broadcast(game.roomId, 'room_update');
          socketService.broadcastLobby('room_update');
          return;
      }

      // Next turn
      this.nextTurn(game);
      socketService.broadcast(game.roomId, 'game_update');
  }

  handlePass(roomId: string, playerId: string) {
      const game = this.games.get(roomId);
      if (!game) throw new Error('Game not found');
      if (game.currentTurn !== playerId) throw new Error('Not your turn');
      
      if (!game.lastMove || game.lastMove.playerId === playerId) {
          throw new Error('Cannot pass when you have free play');
      }

      game.passCount += 1;
      this.nextTurn(game);

      const room = roomService.getRoom(game.roomId);
      if (room && game.lastMove && game.passCount >= room.players.length - 1) {
          game.currentTurn = game.lastMove.playerId;
          game.lastMove = null;
          game.passCount = 0;
      }
      socketService.broadcast(game.roomId, 'game_update');
  }

  private isForcedBid(hand: Card[]): boolean {
      const count3 = hand.filter(c => c.rank === 3).length;
      const hasHeart4 = hand.some(c => c.suit === Suit.HEARTS && c.rank === 4);
      if (count3 >= 3) return true;
      if (count3 >= 2 && hasHeart4) return true;
      return false;
  }

  private getLowestHeartPlayerId(game: GameState): string {
      const entries = Object.entries(game.playersHand);
      let bestPlayerId = entries[0]?.[0] || '';
      let bestValue = Infinity;
      entries.forEach(([pid, hand]) => {
          hand.forEach(c => {
              if (c.suit !== Suit.HEARTS) return;
              const v = getCompareValue(c.rank);
              if (v < bestValue) {
                  bestValue = v;
                  bestPlayerId = pid;
              }
          });
      });
      return bestPlayerId;
  }

  private findHeart4Owner(game: GameState): string {
      const entry = Object.entries(game.playersHand).find(([, hand]) => hand.some(c => c.suit === Suit.HEARTS && c.rank === 4));
      return entry ? entry[0] : game.currentTurn;
  }


  private nextTurn(game: GameState) {
      const room = roomService.getRoom(game.roomId);
      if (!room) return;
      
      const currentIndex = room.players.findIndex(p => p.id === game.currentTurn);
      let nextIndex = (currentIndex + 1) % room.players.length;
      let nextPlayerId = room.players[nextIndex].id;

      // If next player is the one who played last move, they get free turn.
      // But here we just move turn. 
      // The logic "if game.lastMove.playerId === nextPlayerId" handles the free turn check in handlePlayCards/Pass.
      
      // However, if we circle back to the person who played last, we should clear lastMove?
      // In standard logic: A plays, B pass, C pass, D pass -> A plays again.
      // So if nextPlayerId === game.lastMove.playerId, we let them play freely.
      // We don't need to clear lastMove, just logic in handlePlayCards allows anything if lastMove.playerId === current.
      
      game.currentTurn = nextPlayerId;
  }

  getGameState(roomId: string, playerId: string): any {
    const game = this.games.get(roomId);
    if (!game) return null;

    // Return masked state similar to Node.js backend
    const room = roomService.getRoom(roomId);
    return {
      roomId: game.roomId,
      hostId: room?.hostId,
      myHand: game.playersHand[playerId] || [],
      otherPlayers: Object.keys(game.playersHand).filter(id => id !== playerId).map(id => {
        const player = room?.players.find(p => p.id === id);
        return {
            id,
            name: player ? player.name : 'Unknown', // Use name from room player list
            cardCount: game.playersHand[id].length
        };
      }),
      currentTurn: game.currentTurn,
      phase: game.phase,
      bidScore: game.bidScore,
      diggerId: game.diggerId,
      lastMove: game.lastMove,
      holeCards: game.phase === 'TAKING_HOLE' ? game.deck : []
    };
  }

  // ... (getSocketIdForPlayer stub)
  private getSocketIdForPlayer(playerId: string): string | undefined {
      return undefined;
  }
}

export const gameService = new GameService();
