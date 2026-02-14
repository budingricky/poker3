import { Card, Suit, GameState } from '../models/gameTypes.js';
import { Room, Player, RoomStatus } from '../models/types.js';
import { roomService } from './roomService.js';
import { socketService } from './socketService.js';
import { analyzeHand, canBeat, sortCards, getCompareValue } from './gameLogic.js';

class GameService {
  private games: Map<string, GameState> = new Map();
  private lastWinnerByRoom: Map<string, string> = new Map();
  private nextRoundReadyByRoom: Map<string, Set<string>> = new Map();
  private pendingSettlementByRoom: Map<
    string,
    {
      round: number
      bidScore: number
      diggerId: string | null
      winnerId: string
      winnerSide: 'DIGGER' | 'OTHERS'
      baseResults: Array<{ playerId: string; name: string; baseDelta: number; isWinner: boolean }>
      createdAt: number
    }
  > = new Map()
  private settlementMultiplierByRoom: Map<string, number | null> = new Map()
  private settlementHistoryByRoom: Map<
    string,
    Array<{
      round: number
      bidScore: number
      multiplier?: number
      diggerId: string | null
      winnerId: string
      winnerSide: 'DIGGER' | 'OTHERS'
      results: Array<{ playerId: string; name: string; delta: number; isWinner: boolean }>
      createdAt: number
    }>
  > = new Map()
  private undoByRoom: Map<
    string,
    {
      playerId: string
      playedCards: Card[]
      prevLastMove: GameState['lastMove']
      prevPassCount: number
      prevPlayedCount: number
      prevPlayedMoveCount: number
    }
  > = new Map();

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
    const activePlayers = room.players.filter(p => p.isOnline)
    if (activePlayers.length < room.maxPlayers) throw new Error('玩家人数不足');
    if (room.status !== RoomStatus.WAITING) throw new Error('游戏已开始');
    if (this.games.has(roomId)) throw new Error('游戏已开始');
    this.undoByRoom.delete(roomId);

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
    const cardsPerPlayer = (deck.length - holeCardsCount) / activePlayers.length;
    
    const playersHand: { [playerId: string]: Card[] } = {};
    const playedCardsByPlayer: { [playerId: string]: Card[] } = {};
    const playedMovesByPlayer: GameState['playedMovesByPlayer'] = {};
    let currentCardIndex = 0;

    activePlayers.forEach(player => {
      const hand = deck.slice(currentCardIndex, currentCardIndex + cardsPerPlayer);
      playersHand[player.id] = sortCards(hand); // Sort by rank desc
      playedCardsByPlayer[player.id] = []
      playedMovesByPlayer[player.id] = []
      currentCardIndex += cardsPerPlayer;
      player.handCards = hand.map(c => c.code);
    });

    const holeCards = deck.slice(currentCardIndex);

    const lastWinnerId = this.lastWinnerByRoom.get(roomId);
    const biddingStarterId =
      lastWinnerId && activePlayers.some(p => p.id === lastWinnerId) ? lastWinnerId : activePlayers[0].id;

    const gameState: GameState = {
      roomId,
      deck: holeCards, // These are the hole cards
      playersHand,
      playedCardsByPlayer,
      playedMovesByPlayer,
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

  resetRoomToWaiting(roomId: string) {
    this.games.delete(roomId)
    this.nextRoundReadyByRoom.delete(roomId)
    this.undoByRoom.delete(roomId)
    this.lastWinnerByRoom.delete(roomId)
    this.settlementHistoryByRoom.delete(roomId)
    this.pendingSettlementByRoom.delete(roomId)
    this.settlementMultiplierByRoom.delete(roomId)
    const room = roomService.getRoom(roomId)
    if (room) {
      room.status = RoomStatus.WAITING
      for (const p of room.players) {
        p.handCards = []
        p.score = 0
      }
    }
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

      this.undoByRoom.set(roomId, {
        playerId,
        playedCards: [...cardsToPlay],
        prevLastMove: game.lastMove,
        prevPassCount: game.passCount,
        prevPlayedCount: (game.playedCardsByPlayer?.[playerId] || []).length,
        prevPlayedMoveCount: (game.playedMovesByPlayer?.[playerId] || []).length,
      })

      // Valid play
      // Remove cards from hand
      game.playersHand[playerId] = hand.filter(c => !cardCodes.includes(c.code));
      if (!game.playedCardsByPlayer[playerId]) game.playedCardsByPlayer[playerId] = []
      game.playedCardsByPlayer[playerId].push(...cardsToPlay)
      if (!game.playedMovesByPlayer[playerId]) game.playedMovesByPlayer[playerId] = []
      game.playedMovesByPlayer[playerId].push({ cards: cardsToPlay, pattern })
      
      // Update last move
      game.lastMove = {
          playerId,
          cards: cardsToPlay,
          pattern
      };
      game.passCount = 0;

      // Check win
      if (game.playersHand[playerId].length === 0) {
          this.undoByRoom.delete(roomId);
          game.phase = 'FINISHED';
          const room = roomService.getRoom(game.roomId);
          if (room) room.status = RoomStatus.FINISHED;
          this.lastWinnerByRoom.set(roomId, playerId);
          const winnerSide = game.diggerId === playerId ? 'DIGGER' : 'OTHERS';
      if (room) {
        const base = typeof game.bidScore === 'number' ? game.bidScore : 0
        const othersCount = Math.max(0, room.players.length - 1)
        const round = (this.settlementHistoryByRoom.get(roomId)?.length || 0) + 1
        const baseResults = room.players.map(p => {
          const isDigger = game.diggerId === p.id
          const isWinner = winnerSide === 'DIGGER' ? isDigger : !isDigger
          const baseDelta =
            winnerSide === 'DIGGER'
              ? isDigger
                ? base * othersCount
                : -base
              : isDigger
                ? -base * othersCount
                : base
          return { playerId: p.id, name: p.name, baseDelta, isWinner }
        })
        this.pendingSettlementByRoom.set(roomId, {
          round,
          bidScore: base,
          diggerId: game.diggerId,
          winnerId: playerId,
          winnerSide,
          baseResults,
          createdAt: Date.now(),
        })
        this.settlementMultiplierByRoom.set(roomId, null)
      }
          socketService.broadcast(game.roomId, 'game_over', { winnerId: playerId, winnerSide });
          socketService.broadcast(game.roomId, 'room_update');
          socketService.broadcastLobby('room_update');
          return;
      }

      const isMax = this.isCurrentMoveMax(game, playerId);
      if (isMax) {
        game.currentTurn = playerId;
        socketService.broadcast(game.roomId, 'max_play', {
          playerId,
          cards: cardsToPlay,
          pattern,
        });
      } else {
        this.nextTurn(game);
      }
      socketService.broadcast(game.roomId, 'game_update');
  }

  handlePass(roomId: string, playerId: string) {
      const game = this.games.get(roomId);
      if (!game) throw new Error('Game not found');
      if (game.currentTurn !== playerId) throw new Error('Not your turn');
      this.undoByRoom.delete(roomId);
      
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

  undoLastMove(roomId: string, playerId: string) {
    const game = this.games.get(roomId)
    if (!game) throw new Error('Game not found')
    if (game.phase !== 'PLAYING') throw new Error('Not in playing phase')
    if (!game.lastMove || game.lastMove.playerId !== playerId) throw new Error('No undoable move')
    if (game.passCount !== 0) throw new Error('Cannot undo after others acted')

    const undo = this.undoByRoom.get(roomId)
    if (!undo || undo.playerId !== playerId) throw new Error('No undoable move')

    const hand = game.playersHand[playerId] || []
    game.playersHand[playerId] = sortCards([...hand, ...undo.playedCards])
    game.lastMove = undo.prevLastMove
    game.passCount = undo.prevPassCount
    const pile = game.playedCardsByPlayer[playerId] || []
    if (undo.prevPlayedCount >= 0 && undo.prevPlayedCount <= pile.length) {
      game.playedCardsByPlayer[playerId] = pile.slice(0, undo.prevPlayedCount)
    }
    const moves = game.playedMovesByPlayer?.[playerId] || []
    if (undo.prevPlayedMoveCount >= 0 && undo.prevPlayedMoveCount <= moves.length) {
      game.playedMovesByPlayer[playerId] = moves.slice(0, undo.prevPlayedMoveCount)
    }
    game.currentTurn = playerId
    this.undoByRoom.delete(roomId)

    socketService.broadcast(roomId, 'undo', { playerId })
    socketService.broadcast(roomId, 'game_update')
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
    const players = room?.players || []
    const myIndex = players.findIndex(p => p.id === playerId)
    const orderedOthers =
      myIndex >= 0
        ? Array.from({ length: Math.max(0, players.length - 1) }, (_, i) => players[(myIndex + i + 1) % players.length])
        : players.filter(p => p.id !== playerId)
    const winnerId = game.phase === 'FINISHED' ? this.lastWinnerByRoom.get(roomId) || null : null
    const winnerSide =
      winnerId && game.diggerId ? (game.diggerId === winnerId ? 'DIGGER' : 'OTHERS') : undefined
    return {
      roomId: game.roomId,
      hostId: room?.hostId,
      roomStatus: room?.status,
      maxPlayers: room?.maxPlayers,
      playerCount: room?.players?.length,
      onlineCount: room?.players?.filter(p => p.isOnline).length,
      myHand: game.playersHand[playerId] || [],
      myPlayedCards: game.playedCardsByPlayer?.[playerId] || [],
      myPlayedMoves: game.playedMovesByPlayer?.[playerId] || [],
      otherPlayers: orderedOthers
        .filter(p => p.id !== playerId)
        .map(p => ({
          id: p.id,
          name: p.name,
          isOnline: p.isOnline,
          cardCount: (game.playersHand[p.id] || []).length,
        })),
      currentTurn: game.currentTurn,
      phase: game.phase,
      passCount: game.passCount,
      bidScore: game.bidScore,
      diggerId: game.diggerId,
      lastMove: game.lastMove,
      winnerId,
      winnerSide,
      settlementMultiplier: this.settlementMultiplierByRoom.get(roomId) ?? null,
      settlementMultiplierPending: this.pendingSettlementByRoom.has(roomId) && (this.settlementMultiplierByRoom.get(roomId) ?? null) === null,
      holeCards: game.phase === 'TAKING_HOLE' ? game.deck : [],
      nextRoundReady: room?.status === RoomStatus.FINISHED ? Array.from(this.nextRoundReadyByRoom.get(roomId) || []) : [],
      settlementHistory: this.settlementHistoryByRoom.get(roomId) || [],
    };
  }

  markNextRoundReady(roomId: string, playerId: string) {
    const room = roomService.getRoom(roomId)
    if (!room) throw new Error('房间未找到')
    if (room.status !== RoomStatus.FINISHED) throw new Error('当前不在结算阶段')
    if (!room.players.some(p => p.id === playerId)) throw new Error('玩家不在房间内')

    const set = this.nextRoundReadyByRoom.get(roomId) || new Set<string>()
    set.add(playerId)
    this.nextRoundReadyByRoom.set(roomId, set)

    socketService.broadcast(roomId, 'next_round_ready', {
      playerId,
      readyCount: set.size,
      totalCount: room.maxPlayers,
      playerCount: room.players.length,
    })

    const onlineCount = room.players.filter(p => p.isOnline).length
    if (onlineCount >= room.maxPlayers && set.size >= onlineCount) {
      this.restartGame(roomId)
    }
  }

  restartGame(roomId: string) {
    const room = roomService.getRoom(roomId)
    if (!room) throw new Error('房间未找到')
    if (room.players.filter(p => p.isOnline).length < room.maxPlayers) throw new Error('玩家人数不足')
    room.status = RoomStatus.WAITING
    this.games.delete(roomId)
    this.nextRoundReadyByRoom.delete(roomId)
    this.undoByRoom.delete(roomId)
    this.pendingSettlementByRoom.delete(roomId)
    this.settlementMultiplierByRoom.delete(roomId)
    this.startGame(roomId)
  }

  setSettlementMultiplier(roomId: string, playerId: string, multiplier: number) {
    const room = roomService.getRoom(roomId)
    if (!room) throw new Error('房间未找到')
    if (room.status !== RoomStatus.FINISHED) throw new Error('当前不在结算阶段')
    if (room.hostId !== playerId) throw new Error('仅房主可选择翻倍')
    if (![1, 2, 4, 8].includes(multiplier)) throw new Error('无效倍数')

    const pending = this.pendingSettlementByRoom.get(roomId)
    if (!pending) throw new Error('当前无待结算的翻倍选择')

    const already = this.settlementMultiplierByRoom.get(roomId)
    if (typeof already === 'number' && already > 0) return

    this.settlementMultiplierByRoom.set(roomId, multiplier)

    const history = this.settlementHistoryByRoom.get(roomId) || []
    const results = pending.baseResults.map(r => ({
      playerId: r.playerId,
      name: r.name,
      delta: r.baseDelta * multiplier,
      isWinner: r.isWinner,
    }))

    for (const p of room.players) {
      const r = results.find(x => x.playerId === p.id)
      if (!r) continue
      p.score = (p.score || 0) + (Number(r.delta) || 0)
    }

    history.push({
      round: pending.round,
      bidScore: pending.bidScore,
      multiplier,
      diggerId: pending.diggerId,
      winnerId: pending.winnerId,
      winnerSide: pending.winnerSide,
      results,
      createdAt: pending.createdAt,
    })
    this.settlementHistoryByRoom.set(roomId, history)
    this.pendingSettlementByRoom.delete(roomId)

    socketService.broadcast(roomId, 'settlement_multiplier', { multiplier })
    socketService.broadcast(roomId, 'room_update')
    socketService.broadcast(roomId, 'game_update')
    socketService.broadcastLobby('room_update')
  }

  handlePlayerLeft(roomId: string, playerId: string) {
    const set = this.nextRoundReadyByRoom.get(roomId)
    if (set) {
      set.delete(playerId)
      if (set.size === 0) this.nextRoundReadyByRoom.delete(roomId)
      else this.nextRoundReadyByRoom.set(roomId, set)
    }
    const undo = this.undoByRoom.get(roomId)
    if (undo?.playerId === playerId) this.undoByRoom.delete(roomId)
    if (set && set.size > 0) {
      const room = roomService.getRoom(roomId)
      if (room) {
        socketService.broadcast(roomId, 'next_round_ready', {
          playerId,
          readyCount: set.size,
          totalCount: room.maxPlayers,
          playerCount: room.players.length,
        })
      }
    }
  }

  handlePlayerJoined(roomId: string) {
    if (this.nextRoundReadyByRoom.has(roomId)) {
      this.nextRoundReadyByRoom.delete(roomId)
      const room = roomService.getRoom(roomId)
      if (room) {
        socketService.broadcast(roomId, 'next_round_ready', {
          playerId: '',
          readyCount: 0,
          totalCount: room.maxPlayers,
          playerCount: room.players.length,
        })
      }
    }
  }

  handleRoomDeleted(roomId: string) {
    this.games.delete(roomId)
    this.nextRoundReadyByRoom.delete(roomId)
    this.undoByRoom.delete(roomId)
    this.lastWinnerByRoom.delete(roomId)
    this.settlementHistoryByRoom.delete(roomId)
  }

  private isCurrentMoveMax(game: GameState, playerId: string) {
    const lastMove = game.lastMove
    if (!lastMove || lastMove.playerId !== playerId) return false

    const p = lastMove.pattern
    // 3 is rank 3 but has compare value 13 (max for single/pair/triplet/quad)
    if (p.type === 'SINGLE') return p.rank === 3
    if (p.type === 'PAIR') return p.rank === 3
    if (p.type === 'TRIPLET') return p.rank === 3
    if (p.type === 'QUAD') return p.rank === 3
    
    // Straights max out at K (rank 13)
    if (p.type === 'STRAIGHT') return p.rank === 13
    if (p.type === 'CONSECUTIVE_PAIRS') return p.rank === 13
    if (p.type === 'CONSECUTIVE_TRIPLETS') return p.rank === 13
    
    return false
  }

  private canAnyBeat(hand: Card[], lastMove: NonNullable<GameState['lastMove']>): boolean {
    const p = lastMove.pattern
    const lastRankValue = getCompareValue(p.rank)
    const counts = new Map<number, number>()
    for (const c of hand) counts.set(c.rank, (counts.get(c.rank) || 0) + 1)

    const hasSingleAbove = () => {
      let best = -Infinity
      for (const rank of counts.keys()) best = Math.max(best, getCompareValue(rank))
      return best > lastRankValue
    }

    const hasOfKindAbove = (need: number) => {
      for (const [rank, cnt] of counts.entries()) {
        if (cnt >= need && getCompareValue(rank) > lastRankValue) return true
      }
      return false
    }

    const hasStraightAbove = (len: number, needCountPerRank: number) => {
      const minRank = 3
      const maxRank = 13
      for (let start = minRank; start <= maxRank - len + 1; start += 1) {
        const end = start + len - 1
        if (end <= p.rank) continue
        let ok = true
        for (let r = start; r <= end; r += 1) {
          if ((counts.get(r) || 0) < needCountPerRank) {
            ok = false
            break
          }
        }
        if (ok) return true
      }
      return false
    }

    switch (p.type) {
      case 'SINGLE':
        return hasSingleAbove()
      case 'PAIR':
        return hasOfKindAbove(2)
      case 'TRIPLET':
        return hasOfKindAbove(3)
      case 'QUAD':
        return hasOfKindAbove(4)
      case 'STRAIGHT':
        return hasStraightAbove(p.length, 1)
      case 'CONSECUTIVE_PAIRS': {
        const pairCount = p.length
        return hasStraightAbove(pairCount, 2)
      }
      case 'CONSECUTIVE_TRIPLETS': {
        const tripletCount = p.length
        return hasStraightAbove(tripletCount, 3)
      }
      default:
        return false
    }
  }

  // ... (getSocketIdForPlayer stub)
  private getSocketIdForPlayer(playerId: string): string | undefined {
      return undefined;
  }
}

export const gameService = new GameService();
