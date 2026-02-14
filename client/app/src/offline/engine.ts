export type Suit = 'H' | 'D' | 'C' | 'S' | 'J'

export interface Card {
  suit: Suit
  rank: number
  code: string
}

export type CardType =
  | 'SINGLE'
  | 'PAIR'
  | 'TRIPLET'
  | 'QUAD'
  | 'STRAIGHT'
  | 'CONSECUTIVE_PAIRS'
  | 'CONSECUTIVE_TRIPLETS'

export interface HandPattern {
  type: CardType
  rank: number
  length: number
}

export interface PlayedMove {
  cards: Card[]
  pattern: HandPattern
}

export interface RoundPlayerResult {
  playerId: string
  name: string
  delta: number
  isWinner: boolean
}

export interface RoundSettlement {
  round: number
  bidScore: number
  diggerId: string | null
  winnerId: string
  winnerSide: 'DIGGER' | 'OTHERS'
  results: RoundPlayerResult[]
  createdAt: number
}

export type Phase = 'BIDDING' | 'TAKING_HOLE' | 'PLAYING' | 'FINISHED'
export type Difficulty = 'easy' | 'normal' | 'hard'

export interface OfflinePlayer {
  id: string
  name: string
  isOnline: boolean
  isHuman: boolean
}

export interface LastMove {
  playerId: string
  cards: Card[]
  pattern: HandPattern
}

export interface OfflineViewOtherPlayer {
  id: string
  name: string
  isOnline: boolean
  cardCount: number
}

export interface OfflineGameView {
  roomId: string
  hostId: string
  roomStatus: 'WAITING' | 'PLAYING' | 'FINISHED'
  maxPlayers: number
  playerCount: number
  onlineCount: number
  myHand: Card[]
  myPlayedCards: Card[]
  myPlayedMoves: PlayedMove[]
  settlementHistory: RoundSettlement[]
  totalScoreByPlayer: Record<string, number>
  bidByPlayer: Record<string, number | null>
  otherPlayers: OfflineViewOtherPlayer[]
  currentTurn: string
  phase: Phase
  passCount: number
  bidScore: number
  diggerId: string | null
  lastMove: LastMove | null
  holeCards: Card[]
  winnerId: string | null
  winnerSide?: 'DIGGER' | 'OTHERS'
  nextRoundReady: string[]
}

export type EngineActionType = 'start' | 'bid' | 'take_hole' | 'play' | 'pass' | 'undo'

export interface EngineAction {
  seq: number
  type: EngineActionType
  playerId: string
  score?: number
  isMax?: boolean
}

function randomId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`
}

export const getCompareValue = (rank: number): number => {
  if (rank === 3) return 13
  if (rank === 15) return 12
  if (rank === 14) return 11
  return rank - 4
}

export const sortCards = (cards: Card[]): Card[] => {
  return [...cards].sort((a, b) => getCompareValue(b.rank) - getCompareValue(a.rank))
}

const isStraight = (ranks: number[]): boolean => {
  if (ranks.length < 3) return false
  if (ranks[0] < 4) return false
  if (ranks[ranks.length - 1] > 13) return false
  for (let i = 0; i < ranks.length - 1; i += 1) {
    if (ranks[i + 1] !== ranks[i] + 1) return false
  }
  return true
}

const isConsecutivePairs = (ranks: number[]): boolean => {
  if (ranks.length < 6 || ranks.length % 2 !== 0) return false
  if (ranks[0] < 4) return false
  if (ranks[ranks.length - 1] > 13) return false
  for (let i = 0; i < ranks.length; i += 2) {
    if (ranks[i] !== ranks[i + 1]) return false
    if (i > 0 && ranks[i] !== ranks[i - 2] + 1) return false
  }
  return true
}

const isConsecutiveTriplets = (ranks: number[]): boolean => {
  if (ranks.length < 6 || ranks.length % 3 !== 0) return false
  if (ranks[0] < 4) return false
  if (ranks[ranks.length - 1] > 13) return false
  for (let i = 0; i < ranks.length; i += 3) {
    if (!(ranks[i] === ranks[i + 1] && ranks[i + 1] === ranks[i + 2])) return false
    if (i > 0 && ranks[i] !== ranks[i - 3] + 1) return false
  }
  return true
}

export const analyzeHand = (cards: Card[]): HandPattern | null => {
  if (cards.length === 0) return null
  const sorted = [...cards].sort((a, b) => a.rank - b.rank)
  const len = sorted.length
  const ranks = sorted.map(c => c.rank)

  if (len === 4 && ranks[0] === ranks[3]) return { type: 'QUAD', rank: ranks[0], length: 4 }
  if (len === 1) return { type: 'SINGLE', rank: ranks[0], length: 1 }
  if (len === 2 && ranks[0] === ranks[1]) return { type: 'PAIR', rank: ranks[0], length: 2 }
  if (len === 3 && ranks[0] === ranks[2]) return { type: 'TRIPLET', rank: ranks[0], length: 3 }
  if (len >= 3 && isStraight(ranks)) return { type: 'STRAIGHT', rank: ranks[len - 1], length: len }
  if (len >= 6 && len % 2 === 0 && isConsecutivePairs(ranks)) {
    return { type: 'CONSECUTIVE_PAIRS', rank: ranks[len - 1], length: len / 2 }
  }
  if (len >= 6 && len % 3 === 0 && isConsecutiveTriplets(ranks)) {
    return { type: 'CONSECUTIVE_TRIPLETS', rank: ranks[len - 1], length: len / 3 }
  }
  return null
}

export const canBeat = (current: Card[], last: Card[]): boolean => {
  const curr = analyzeHand(current)
  const prev = analyzeHand(last)
  if (!curr || !prev) return false
  if (curr.type !== prev.type) return false
  if (curr.length !== prev.length) return false
  return getCompareValue(curr.rank) > getCompareValue(prev.rank)
}

function pickN<T>(arr: T[], n: number) {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = copy[i]
    copy[i] = copy[j]
    copy[j] = tmp
  }
  return copy.slice(0, n)
}

function buildCounts(hand: Card[]) {
  const byRank = new Map<number, Card[]>()
  for (const c of hand) {
    const list = byRank.get(c.rank) || []
    list.push(c)
    byRank.set(c.rank, list)
  }
  return byRank
}

function generatePlays(hand: Card[]) {
  const plays: Card[][] = []
  const byRank = buildCounts(hand)

  for (const c of hand) plays.push([c])

  for (const list of byRank.values()) {
    if (list.length >= 2) plays.push(list.slice(0, 2))
    if (list.length >= 3) plays.push(list.slice(0, 3))
    if (list.length >= 4) plays.push(list.slice(0, 4))
  }

  const uniqueRanks = Array.from(byRank.keys()).sort((a, b) => a - b)
  const available = new Set(uniqueRanks.filter(r => r >= 3 && r <= 13))
  for (let start = 3; start <= 13; start += 1) {
    if (!available.has(start)) continue
    let end = start
    while (end + 1 <= 13 && available.has(end + 1)) end += 1
    for (let len = 3; len <= end - start + 1; len += 1) {
      for (let s = start; s <= end - len + 1; s += 1) {
        const cards: Card[] = []
        for (let r = s; r < s + len; r += 1) {
          cards.push((byRank.get(r) || [])[0])
        }
        plays.push(cards)
      }
    }
    start = end
  }

  for (let start = 3; start <= 13; start += 1) {
    let end = start
    const has2 = (r: number) => (byRank.get(r)?.length || 0) >= 2
    while (end + 1 <= 13 && has2(end + 1)) end += 1
    if (!has2(start)) continue
    for (let pairLen = 3; pairLen <= end - start + 1; pairLen += 1) {
      for (let s = start; s <= end - pairLen + 1; s += 1) {
        const cards: Card[] = []
        for (let r = s; r < s + pairLen; r += 1) {
          const list = byRank.get(r) || []
          cards.push(list[0], list[1])
        }
        plays.push(cards)
      }
    }
    start = end
  }

  for (let start = 3; start <= 13; start += 1) {
    let end = start
    const has3 = (r: number) => (byRank.get(r)?.length || 0) >= 3
    while (end + 1 <= 13 && has3(end + 1)) end += 1
    if (!has3(start)) continue
    for (let triLen = 2; triLen <= end - start + 1; triLen += 1) {
      for (let s = start; s <= end - triLen + 1; s += 1) {
        const cards: Card[] = []
        for (let r = s; r < s + triLen; r += 1) {
          const list = byRank.get(r) || []
          cards.push(list[0], list[1], list[2])
        }
        plays.push(cards)
      }
    }
    start = end
  }

  const normalized = new Map<string, Card[]>()
  for (const p of plays) {
    const key = p.map(c => c.code).sort().join(',')
    if (!normalized.has(key)) normalized.set(key, p)
  }
  return Array.from(normalized.values())
}

function scorePlay(cards: Card[]) {
  const pattern = analyzeHand(cards)
  if (!pattern) return { valid: false as const, count: cards.length, value: Infinity, type: '' as CardType }
  return {
    valid: true as const,
    count: cards.length,
    value: getCompareValue(pattern.rank),
    type: pattern.type,
  }
}

export class OfflineEngine {
  readonly roomId = 'offline'
  readonly maxPlayers = 4
  readonly hostId: string
  readonly humanId: string
  readonly difficulty: Difficulty

  players: OfflinePlayer[]
  roomStatus: 'WAITING' | 'PLAYING' | 'FINISHED' = 'WAITING'

  phase: Phase = 'BIDDING'
  deck: Card[] = []
  holeCards: Card[] = []
  playersHand: Record<string, Card[]> = {}
  playedCardsByPlayer: Record<string, Card[]> = {}
  playedMovesByPlayer: Record<string, PlayedMove[]> = {}
  totalScoreByPlayer: Record<string, number> = {}
  settlementHistory: RoundSettlement[] = []
  bidByPlayer: Record<string, number | null> = {}
  currentTurn = ''
  bidScore = 0
  diggerId: string | null = null
  biddingStarterId = ''
  passCount = 0
  lastMove: LastMove | null = null
  winnerId: string | null = null
  winnerSide?: 'DIGGER' | 'OTHERS'
  nextRoundReady: Set<string> = new Set()
  actionSeq = 0
  lastAction: EngineAction | null = null

  private undo:
    | {
        playerId: string
        playedCards: Card[]
        prevLastMove: LastMove | null
        prevPassCount: number
        prevPlayedCount: number
        prevPlayedMoveCount: number
      }
    | null = null

  constructor(params: { humanName: string; otherNames: [string, string, string]; difficulty: Difficulty }) {
    const humanId = randomId('p')
    const others = params.otherNames.map(() => randomId('p'))
    this.humanId = humanId
    this.hostId = humanId
    this.difficulty = params.difficulty
    this.players = [
      { id: humanId, name: params.humanName, isOnline: true, isHuman: true },
      { id: others[0], name: params.otherNames[0], isOnline: true, isHuman: false },
      { id: others[1], name: params.otherNames[1], isOnline: true, isHuman: false },
      { id: others[2], name: params.otherNames[2], isOnline: true, isHuman: false },
    ]
    this.totalScoreByPlayer = Object.fromEntries(this.players.map(p => [p.id, 0]))
  }

  private setAction(action: Omit<EngineAction, 'seq'>) {
    this.actionSeq += 1
    this.lastAction = { seq: this.actionSeq, ...action }
  }

  resetToWaiting() {
    this.roomStatus = 'WAITING'
    this.phase = 'BIDDING'
    this.deck = []
    this.holeCards = []
    this.playersHand = {}
    this.playedCardsByPlayer = {}
    this.playedMovesByPlayer = {}
    this.bidByPlayer = {}
    this.currentTurn = ''
    this.bidScore = 0
    this.diggerId = null
    this.biddingStarterId = ''
    this.passCount = 0
    this.lastMove = null
    this.winnerId = null
    this.winnerSide = undefined
    this.nextRoundReady = new Set()
    this.undo = null
    this.lastAction = null
  }

  startGame() {
    this.resetToWaiting()
    this.roomStatus = 'PLAYING'
    this.phase = 'BIDDING'
    const deck = this.shuffle(this.createDeck())
    const holeCardsCount = 4
    const cardsPerPlayer = (deck.length - holeCardsCount) / this.players.length

    this.playersHand = {}
    this.playedCardsByPlayer = {}
    this.playedMovesByPlayer = {}
    this.bidByPlayer = {}
    let idx = 0
    for (const p of this.players) {
      const hand = deck.slice(idx, idx + cardsPerPlayer)
      idx += cardsPerPlayer
      this.playersHand[p.id] = sortCards(hand)
      this.playedCardsByPlayer[p.id] = []
      this.playedMovesByPlayer[p.id] = []
      this.bidByPlayer[p.id] = null
    }
    this.holeCards = deck.slice(idx)
    this.deck = [...this.holeCards]

    this.bidScore = 0
    this.diggerId = null
    this.passCount = 0
    this.lastMove = null
    this.undo = null

    this.biddingStarterId = this.players[0].id
    this.currentTurn = this.biddingStarterId
    this.setAction({ type: 'start', playerId: this.biddingStarterId })
  }

  bid(playerId: string, score: number) {
    if (this.phase !== 'BIDDING') throw new Error('Not in bidding phase')
    if (this.currentTurn !== playerId) throw new Error('Not your turn')
    if (![0, 1, 2, 3, 4].includes(score)) throw new Error('Invalid bid score')
    if (score > 0 && score <= this.bidScore) throw new Error('Must bid higher than current score')
    this.bidByPlayer[playerId] = score
    this.setAction({ type: 'bid', playerId, score })

    const hand = this.playersHand[playerId] || []
    if (this.isForcedBid(hand)) {
      this.bidScore = 4
      this.diggerId = playerId
      this.finalizeBidding()
      return
    }

    if (score > this.bidScore) {
      this.bidScore = score
      this.diggerId = playerId
    }

    if (score === 4) {
      this.finalizeBidding()
      return
    }

    const currentIndex = this.players.findIndex(p => p.id === playerId)
    const nextIndex = (currentIndex + 1) % this.players.length
    const nextId = this.players[nextIndex].id
    if (nextId === this.biddingStarterId) {
      if (this.diggerId === null) {
        this.diggerId = this.getLowestHeartPlayerId()
        this.bidScore = 1
      }
      this.finalizeBidding()
    } else {
      this.currentTurn = nextId
    }
  }

  takeHole(playerId: string) {
    if (this.phase !== 'TAKING_HOLE') throw new Error('Not in taking hole phase')
    if (!this.diggerId || this.diggerId !== playerId) throw new Error('Only digger can take hole cards')
    this.setAction({ type: 'take_hole', playerId })
    const hole = this.deck || []
    if (hole.length > 0) {
      const hand = this.playersHand[playerId] || []
      hand.push(...hole)
      this.playersHand[playerId] = sortCards(hand)
    }
    this.deck = []
    this.phase = 'PLAYING'
    this.passCount = 0
    this.lastMove = null
    this.currentTurn = this.findHeart4Owner()
  }

  playCards(playerId: string, cardCodes: string[]) {
    if (this.phase !== 'PLAYING') throw new Error('Not in playing phase')
    if (this.currentTurn !== playerId) throw new Error('Not your turn')
    const hand = this.playersHand[playerId] || []
    const cardsToPlay = hand.filter(c => cardCodes.includes(c.code))
    if (cardsToPlay.length !== cardCodes.length) throw new Error('Invalid cards')
    const pattern = analyzeHand(cardsToPlay)
    if (!pattern) throw new Error('Invalid card pattern')

    if (this.lastMove && this.lastMove.playerId !== playerId) {
      if (!canBeat(cardsToPlay, this.lastMove.cards)) throw new Error('Cards must be greater than last play')
    }

    this.undo = {
      playerId,
      playedCards: [...cardsToPlay],
      prevLastMove: this.lastMove,
      prevPassCount: this.passCount,
      prevPlayedCount: (this.playedCardsByPlayer[playerId] || []).length,
      prevPlayedMoveCount: (this.playedMovesByPlayer[playerId] || []).length,
    }

    this.playersHand[playerId] = hand.filter(c => !cardCodes.includes(c.code))
    if (!this.playedCardsByPlayer[playerId]) this.playedCardsByPlayer[playerId] = []
    this.playedCardsByPlayer[playerId].push(...cardsToPlay)
    if (!this.playedMovesByPlayer[playerId]) this.playedMovesByPlayer[playerId] = []
    this.playedMovesByPlayer[playerId].push({ cards: cardsToPlay, pattern })

    this.lastMove = { playerId, cards: cardsToPlay, pattern }
    this.passCount = 0

    if (this.playersHand[playerId].length === 0) {
      this.phase = 'FINISHED'
      this.roomStatus = 'FINISHED'
      this.winnerId = playerId
      if (this.diggerId) this.winnerSide = this.diggerId === playerId ? 'DIGGER' : 'OTHERS'
      if (this.diggerId) {
        const base = typeof this.bidScore === 'number' ? this.bidScore : 0
        const othersCount = Math.max(0, this.players.length - 1)
        const winnerSide = this.diggerId === playerId ? 'DIGGER' : 'OTHERS'
        const round = this.settlementHistory.length + 1
        const results: RoundPlayerResult[] = this.players.map(p => {
          const isDigger = p.id === this.diggerId
          const isWinner = winnerSide === 'DIGGER' ? isDigger : !isDigger
          const delta =
            winnerSide === 'DIGGER'
              ? isDigger
                ? base * othersCount
                : -base
              : isDigger
                ? -base * othersCount
                : base
          this.totalScoreByPlayer[p.id] = (this.totalScoreByPlayer[p.id] || 0) + delta
          return { playerId: p.id, name: p.name, delta, isWinner }
        })
        this.settlementHistory.push({
          round,
          bidScore: base,
          diggerId: this.diggerId,
          winnerId: playerId,
          winnerSide,
          results,
          createdAt: Date.now(),
        })
      }
      this.currentTurn = playerId
      this.undo = null
      this.setAction({ type: 'play', playerId, isMax: false })
      return
    }

    const isMax = this.isCurrentMoveMax(playerId)
    if (isMax) {
      this.currentTurn = playerId
      this.setAction({ type: 'play', playerId, isMax: true })
      return
    }
    this.setAction({ type: 'play', playerId, isMax: false })
    this.nextTurn()
  }

  pass(playerId: string) {
    if (this.phase !== 'PLAYING') throw new Error('Not in playing phase')
    if (this.currentTurn !== playerId) throw new Error('Not your turn')
    this.undo = null
    if (!this.lastMove || this.lastMove.playerId === playerId) throw new Error('Cannot pass when you have free play')

    this.setAction({ type: 'pass', playerId })
    this.passCount += 1
    this.nextTurn()
    if (this.lastMove && this.passCount >= this.players.length - 1) {
      this.currentTurn = this.lastMove.playerId
      this.lastMove = null
      this.passCount = 0
    }
  }

  undoLastMove(playerId: string) {
    if (this.phase !== 'PLAYING') throw new Error('Not in playing phase')
    if (!this.lastMove || this.lastMove.playerId !== playerId) throw new Error('No undoable move')
    if (this.passCount !== 0) throw new Error('Cannot undo after others acted')
    if (!this.undo || this.undo.playerId !== playerId) throw new Error('No undoable move')

    const hand = this.playersHand[playerId] || []
    this.playersHand[playerId] = sortCards([...hand, ...this.undo.playedCards])
    this.lastMove = this.undo.prevLastMove
    this.passCount = this.undo.prevPassCount
    const pile = this.playedCardsByPlayer[playerId] || []
    this.playedCardsByPlayer[playerId] = pile.slice(0, this.undo.prevPlayedCount)
    const moves = this.playedMovesByPlayer[playerId] || []
    this.playedMovesByPlayer[playerId] = moves.slice(0, this.undo.prevPlayedMoveCount)
    this.currentTurn = playerId
    this.undo = null
    this.setAction({ type: 'undo', playerId })
  }

  aiStep(playerId: string): EngineAction | null {
    const p = this.players.find(x => x.id === playerId)
    if (!p || p.isHuman) return null
    if (this.roomStatus !== 'PLAYING') return null

    if (this.phase === 'BIDDING') {
      const choice = this.chooseBid(playerId)
      this.bid(playerId, choice)
      return this.lastAction
    }

    if (this.phase === 'TAKING_HOLE') {
      if (this.diggerId === playerId) this.takeHole(playerId)
      return this.lastAction
    }

    if (this.phase === 'PLAYING') {
      const hand = this.playersHand[playerId] || []
      const plays = generatePlays(hand).filter(cards => analyzeHand(cards) !== null)

      const mustFollow = !!this.lastMove && this.lastMove.playerId !== playerId
      const legal = mustFollow ? plays.filter(ply => canBeat(ply, this.lastMove!.cards)) : plays

      if (mustFollow && legal.length === 0) {
        this.pass(playerId)
        return this.lastAction
      }

      const chosen = this.choosePlay(legal)
      this.playCards(playerId, chosen.map(c => c.code))
      return this.lastAction
    }
    return this.lastAction
  }

  getView(forPlayerId: string): OfflineGameView {
    const players = this.players
    const myIndex = players.findIndex(p => p.id === forPlayerId)
    const orderedOthers =
      myIndex >= 0
        ? Array.from({ length: Math.max(0, players.length - 1) }, (_, i) => players[(myIndex + i + 1) % players.length])
        : players.filter(p => p.id !== forPlayerId)
    return {
      roomId: this.roomId,
      hostId: this.hostId,
      roomStatus: this.roomStatus,
      maxPlayers: this.maxPlayers,
      playerCount: players.length,
      onlineCount: players.filter(p => p.isOnline).length,
      myHand: this.playersHand[forPlayerId] || [],
      myPlayedCards: this.playedCardsByPlayer[forPlayerId] || [],
      myPlayedMoves: this.playedMovesByPlayer[forPlayerId] || [],
      settlementHistory: this.settlementHistory,
      totalScoreByPlayer: this.totalScoreByPlayer,
      bidByPlayer: this.bidByPlayer,
      otherPlayers: orderedOthers
        .filter(p => p.id !== forPlayerId)
        .map(p => ({
          id: p.id,
          name: p.name,
          isOnline: p.isOnline,
          cardCount: (this.playersHand[p.id] || []).length,
        })),
      currentTurn: this.currentTurn,
      phase: this.phase,
      passCount: this.passCount,
      bidScore: this.bidScore,
      diggerId: this.diggerId,
      lastMove: this.lastMove,
      holeCards: this.phase === 'TAKING_HOLE' ? this.deck : [],
      winnerId: this.phase === 'FINISHED' ? this.winnerId : null,
      winnerSide: this.phase === 'FINISHED' ? this.winnerSide : undefined,
      nextRoundReady: [],
    }
  }

  private createDeck(): Card[] {
    const deck: Card[] = []
    const suits: Suit[] = ['H', 'D', 'C', 'S']
    for (let rank = 3; rank <= 15; rank += 1) {
      for (const suit of suits) deck.push({ suit, rank, code: `${suit}${rank}` })
    }
    return deck
  }

  private shuffle(deck: Card[]) {
    const d = [...deck]
    for (let i = d.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = d[i]
      d[i] = d[j]
      d[j] = tmp
    }
    return d
  }

  private finalizeBidding() {
    if (!this.diggerId) throw new Error('No digger selected')
    this.phase = 'TAKING_HOLE'
    this.passCount = 0
    this.lastMove = null
    this.currentTurn = this.diggerId
  }

  private isForcedBid(hand: Card[]) {
    const count3 = hand.filter(c => c.rank === 3).length
    const hasHeart4 = hand.some(c => c.suit === 'H' && c.rank === 4)
    if (count3 >= 3) return true
    if (count3 >= 2 && hasHeart4) return true
    return false
  }

  private getLowestHeartPlayerId() {
    const entries = Object.entries(this.playersHand)
    let bestPlayerId = entries[0]?.[0] || this.players[0].id
    let bestValue = Infinity
    for (const [pid, hand] of entries) {
      for (const c of hand) {
        if (c.suit !== 'H') continue
        const v = getCompareValue(c.rank)
        if (v < bestValue) {
          bestValue = v
          bestPlayerId = pid
        }
      }
    }
    return bestPlayerId
  }

  private findHeart4Owner() {
    for (const [pid, hand] of Object.entries(this.playersHand)) {
      if (hand.some(c => c.suit === 'H' && c.rank === 4)) return pid
    }
    return this.currentTurn
  }

  private nextTurn() {
    const currentIndex = this.players.findIndex(p => p.id === this.currentTurn)
    const nextIndex = (currentIndex + 1) % this.players.length
    this.currentTurn = this.players[nextIndex].id
  }

  private canAnyBeat(hand: Card[], lastMove: LastMove) {
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
      case 'CONSECUTIVE_PAIRS':
        return hasStraightAbove(p.length, 2)
      case 'CONSECUTIVE_TRIPLETS':
        return hasStraightAbove(p.length, 3)
      default:
        return false
    }
  }

  private isCurrentMoveMax(playerId: string) {
    const lastMove = this.lastMove
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

  private chooseBid(playerId: string) {
    const hand = this.playersHand[playerId] || []
    const strength = hand.reduce((acc, c) => acc + getCompareValue(c.rank), 0)
    const base = strength / Math.max(1, hand.length)
    const want =
      this.difficulty === 'easy'
        ? base > 7
          ? 2
          : 0
        : this.difficulty === 'normal'
          ? base > 7
            ? 3
            : base > 5
              ? 2
              : 0
          : base > 7
            ? 4
            : base > 6
              ? 3
              : 1
    const options = [0, 1, 2, 3, 4].filter(x => x === 0 || x > this.bidScore)
    const candidates = options.filter(x => x <= want)
    if (candidates.length > 0) return candidates[candidates.length - 1]
    if (options.includes(0)) return 0
    return options[options.length - 1]
  }



  private choosePlay(legal: Card[][]) {
    if (legal.length === 0) return []
    
    // Use MCTS for hard/normal difficulty
    if (this.difficulty !== 'easy') {
        try {
            const mcts = new MCTSEngine(this, this.currentTurn)
            const bestMove = mcts.run(this.difficulty === 'hard' ? 800 : 300) // More iterations for hard
            if (bestMove) return bestMove
        } catch (e) {
            console.error("MCTS Error, falling back", e)
        }
    }

    // Fallback / Easy mode logic
    if (this.difficulty === 'easy') return pickN(legal, 1)[0]
    
    // Heuristic fallback
    const scored = legal.map(cards => ({ cards, s: scorePlay(cards) })).filter(x => x.s.valid)
    scored.sort((a, b) => {
      if (a.s.value !== b.s.value) return a.s.value - b.s.value
      return a.s.count - b.s.count
    })
    return scored[0].cards
  }
}

// --- MCTS Implementation ---

class MCTSNode {
  // Map key: "code,code,code" -> MCTSNode
  children: Map<string, MCTSNode> = new Map()
  visits: number = 0
  wins: number = 0 // Wins for the player who made the move to get HERE
  
  // Untried moves for the state represented by this node. 
  // Note: In IS-MCTS, we don't store "state" in node because state is uncertain.
  // But we store "untried moves" which are legal moves from the public information set?
  // Actually, legal moves depend on the specific hand in determinization.
  // Standard SO-ISMCTS:
  // Node corresponds to [Action History].
  // Children are [Action].
  // We don't store untried moves here because they differ per determinization.
  // We expand based on the current determinization's legal moves.

  constructor(
    public parent: MCTSNode | null = null,
    public move: Card[] | null = null,
    public playerId: string // Who made the move to get here
  ) {}

  get UCB1(): number {
    if (this.visits === 0) return Infinity
    // Exploitation + Exploration
    // We want to maximize win rate for the player at `parent` node?
    // No, standard UCB: Select child that maximizes: (child.wins/child.visits) + C * ...
    // Child wins are stored from perspective of the player who moved to `child`.
    // If it's my turn at `parent`, I want to choose `child` where I (parent.nextPlayer) win most.
    // child.playerId is ME. So child.wins is MY wins. Correct.
    return this.wins / this.visits + 1.414 * Math.sqrt(Math.log(this.parent!.visits) / this.visits)
  }
}

class MCTSEngine {
  constructor(private rootEngine: OfflineEngine, private myPlayerId: string) {}

  // Information Set Monte Carlo Tree Search (Single Observer)
  run(timeoutMs: number): Card[] {
    const rootNode = new MCTSNode(null, null, '')
    // Root represents "Current state before I move".
    // I am `myPlayerId`.

    const startTime = Date.now()
    let iterations = 0

    // Clone basic info once
    const allCards = this.getAllCards()
    const myHand = this.rootEngine.playersHand[this.myPlayerId] || []
    // Identify unknown cards: All cards - My Hand - All Played Cards
    const playedCards = Object.values(this.rootEngine.playedCardsByPlayer).flat()
    const knownCodes = new Set([...myHand.map(c => c.code), ...playedCards.map(c => c.code)])
    const unknownCards = allCards.filter(c => !knownCodes.has(c.code))
    
    // Opponent card counts
    const opponentCounts: Record<string, number> = {}
    for (const p of this.rootEngine.players) {
        if (p.id !== this.myPlayerId) {
            opponentCounts[p.id] = (this.rootEngine.playersHand[p.id] || []).length
        }
    }

    while (Date.now() - startTime < timeoutMs) {
      iterations++
      
      // 1. Determinization: Create a specific world state compatible with public info
      const determinizedState = this.determinize(myHand, unknownCards, opponentCounts)
      
      // 2. Selection: Traverse tree using UCB until we hit a node with untried moves (for this determinization)
      let node = rootNode
      let state = determinizedState

      // While node is fully expanded AND not terminal
      while (true) {
        // Get legal moves for current state
        const legalMoves = this.getLegalMoves(state, state.currentTurn)
        if (legalMoves.length === 0 && state.phase === 'PLAYING') {
            // Must pass (or game over if everyone passes? No, engine handles auto-pass logic usually)
            // If empty, it's a pass.
            // But wait, getLegalMoves returns [] for pass?
            // Engine pass logic: if cannot beat, pass.
            // Let's normalize: [] means Pass.
        }

        if (state.roomStatus === 'FINISHED') break

        // Identify untried moves from THIS node given current state
        // A child exists for a move?
        const untried = legalMoves.filter(m => !node.children.has(this.getMoveKey(m)))
        
        if (untried.length > 0) {
          // 3. Expansion: Pick one untried move, add child, advance state
          const move = untried[Math.floor(Math.random() * untried.length)]
          const moveKey = this.getMoveKey(move)
          
          // Apply move to state
          const mover = state.currentTurn
          this.applyMove(state, mover, move)
          
          const child = new MCTSNode(node, move, mover)
          node.children.set(moveKey, child)
          node = child
          break // Proceed to simulation
        } else {
          // Fully expanded (for this determinization state!), select best child using UCB
          // Filter children to only those VALID in current state (important for IS-MCTS!)
          // Because tree might have children from OTHER determinizations that are illegal here.
          const validChildren = legalMoves
            .map(m => node.children.get(this.getMoveKey(m)))
            .filter((n): n is MCTSNode => !!n)

          if (validChildren.length === 0) break // Should not happen unless terminal

          // Select best
          node = validChildren.reduce((a, b) => a.UCB1 > b.UCB1 ? a : b)
          this.applyMove(state, node.playerId, node.move!)
        }
      }

      // 4. Simulation (Rollout)
      this.simulate(state)

      // 5. Backpropagation
      // Check winner
      const amIWinner = state.winnerId === this.myPlayerId || 
        (state.winnerSide && state.winnerSide === (this.rootEngine.diggerId === this.myPlayerId ? 'DIGGER' : 'OTHERS'))
      
      const winScore = amIWinner ? 1 : 0
      
      // Propagate up
      let curr: MCTSNode | null = node
      while (curr) {
        curr.visits++
        // If this node was reached by ME making a move, and I won, that's good.
        // If this node was reached by OPPONENT making a move, and I won, that's bad for opponent (good for me).
        // Standard MCTS: Nodes store wins for the player who JUST moved.
        // So if `curr.playerId` is ME, and I won, add 1.
        // If `curr.playerId` is OPPONENT, and I won, add 0 (or -1?).
        // Actually simpler: Store wins for the player who made the move.
        // If `curr.playerId` won in `state`, add 1.
        
        const nodePlayerWon = state.winnerId === curr.playerId ||
            (state.winnerSide && state.winnerSide === (this.rootEngine.diggerId === curr.playerId ? 'DIGGER' : 'OTHERS'))
            
        if (nodePlayerWon) curr.wins++
        
        curr = curr.parent
      }
    }
    
    // Return best move from root
    // Max visits is robust
    let bestMove: Card[] = []
    let maxVisits = -1
    
    // Only consider legal moves for the ACTUAL root state (my real hand)
    const rootLegal = this.getLegalMoves(this.rootEngine, this.myPlayerId)
    const rootLegalKeys = new Set(rootLegal.map(m => this.getMoveKey(m)))
    
    for (const [key, child] of rootNode.children) {
        if (!rootLegalKeys.has(key)) continue
        if (child.visits > maxVisits) {
            maxVisits = child.visits
            bestMove = child.move!
        }
    }
    
    // Log for debugging
    console.log(`MCTS: ${iterations} iterations. Best: ${bestMove.map(c=>c.code).join(',')}`)
    return bestMove
  }

  private getAllCards(): Card[] {
     // Recreate full deck
     const deck: Card[] = []
     for (let rank = 3; rank <= 15; rank++) {
         for (const suit of ['H', 'D', 'C', 'S'] as Suit[]) {
             deck.push({ suit, rank, code: `${suit}${rank}` })
         }
     }
     return deck
  }

  private determinize(myHand: Card[], unknownCards: Card[], opponentCounts: Record<string, number>): OfflineEngine {
      const state = this.cloneEngine(this.rootEngine)
      
      // Shuffle unknown cards
      const shuffled = [...unknownCards]
      for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }
      
      // Distribute to opponents
      let idx = 0
      for (const pid in opponentCounts) {
          const count = opponentCounts[pid]
          state.playersHand[pid] = sortCards(shuffled.slice(idx, idx + count))
          idx += count
      }
      // Note: Hole cards? If we are in PLAYING phase, hole cards are already taken or known?
      // In PLAYING phase, hole cards are either in someone's hand or irrelevant.
      // If we are tracking played cards, `unknownCards` accounts for everything not seen.
      // So this is correct.
      
      return state
  }

  private cloneEngine(source: OfflineEngine): OfflineEngine {
      const clone = Object.create(Object.getPrototypeOf(source))
      Object.assign(clone, source)
      clone.playersHand = { ...source.playersHand } // Shallow copy of map is enough as we replace arrays
      clone.playedCardsByPlayer = { ...source.playedCardsByPlayer }
      clone.playedMovesByPlayer = { ...source.playedMovesByPlayer }
      if (source.lastMove) clone.lastMove = { ...source.lastMove }
      return clone
  }

  private getMoveKey(cards: Card[]): string {
      return cards.map(c => c.code).sort().join(',')
  }

  private getLegalMoves(engine: OfflineEngine, playerId: string): Card[][] {
      const hand = engine.playersHand[playerId] || []
      const plays = generatePlays(hand).filter(cards => analyzeHand(cards) !== null)
      const mustFollow = !!engine.lastMove && engine.lastMove.playerId !== playerId
      const legal = mustFollow ? plays.filter(ply => canBeat(ply, engine.lastMove!.cards)) : plays
      if (mustFollow && legal.length === 0) return [] 
      return legal
  }

  private applyMove(engine: OfflineEngine, playerId: string, cards: Card[]) {
      if (cards.length === 0) {
          engine.pass(playerId)
      } else {
          // We need a robust internal play method that doesn't trigger UI/Undo logic
          // Re-implement minimal logic here for speed
          const hand = engine.playersHand[playerId] || []
          const cardCodes = new Set(cards.map(c => c.code))
          engine.playersHand[playerId] = hand.filter(c => !cardCodes.has(c.code))
          
          // Update last move
          const pattern = analyzeHand(cards)!
          engine.lastMove = { playerId, cards, pattern }
          engine.passCount = 0
          
          // Check win
          if (engine.playersHand[playerId].length === 0) {
              engine.roomStatus = 'FINISHED'
              engine.winnerId = playerId
              if (engine.diggerId) engine.winnerSide = engine.diggerId === playerId ? 'DIGGER' : 'OTHERS'
              return
          }
          
          // Check max (Optimization: if max, keep turn)
          // For simulation, we can skip this or implement it. 
          // If we implement it, we don't advance turn.
          // Let's implement basic max check
           if (this.isMax(engine, cards, pattern)) {
               engine.currentTurn = playerId
               return
           }
      }
      
      // Next turn
      const idx = engine.players.findIndex(p => p.id === playerId)
      let nextIdx = (idx + 1) % engine.players.length
      engine.currentTurn = engine.players[nextIdx].id
      
      if (cards.length === 0) {
          engine.passCount++
          if (engine.passCount >= engine.players.length - 1 && engine.lastMove) {
              engine.currentTurn = engine.lastMove.playerId
              engine.lastMove = null
              engine.passCount = 0
          }
      }
  }

  private isMax(engine: OfflineEngine, cards: Card[], pattern: HandPattern): boolean {
      // Simplified absolute max check
      if (pattern.type === 'SINGLE' || pattern.type === 'PAIR' || pattern.type === 'TRIPLET' || pattern.type === 'QUAD') {
          return pattern.rank === 3 // Rank 3 is highest (value 13)
      }
      if (['STRAIGHT', 'CONSECUTIVE_PAIRS', 'CONSECUTIVE_TRIPLETS'].includes(pattern.type)) {
          return pattern.rank === 13 // K is highest end for straights
      }
      return false
  }

  private simulate(state: OfflineEngine) {
      let depth = 0
      while (state.roomStatus === 'PLAYING' && depth < 60) {
          const pid = state.currentTurn
          const hand = state.playersHand[pid] || []
          const legal = this.getLegalMoves(state, pid)
          
          if (legal.length === 0) {
              this.applyMove(state, pid, [])
          } else {
              // Heuristic Play:
              // 1. Prefer playing cards if possible (avoid passing if free play)
              // 2. Avoid single cards if possible, unless it's a high single
              
              let chosen: Card[]
              if (!state.lastMove || state.lastMove.playerId === pid) {
                  // Free play
                  // Try to play longest patterns or smallest non-single
                  // Filter out singles unless that's all we have
                  const nonSingles = legal.filter(m => m.length > 1)
                  if (nonSingles.length > 0) {
                      // Pick random non-single
                      chosen = nonSingles[Math.floor(Math.random() * nonSingles.length)]
                  } else {
                      // Only singles
                      chosen = legal[Math.floor(Math.random() * legal.length)]
                  }
              } else {
                  // Must follow
                  // Try to win low? Random is fine for now, but weighted random better.
                  // Prefer passing if we only have high cards and bid is low? Too complex.
                  // Just random valid move.
                  chosen = legal[Math.floor(Math.random() * legal.length)]
              }
              this.applyMove(state, pid, chosen)
          }
          depth++
      }
  }
}



export function pickAiNames(params: { preset: string[]; exclude: string; count: number }) {
  const pool = params.preset.filter(n => n !== params.exclude)
  const picked = pickN(pool, params.count)
  const set = new Set(picked)
  if (set.size === params.count) return picked
  const unique: string[] = []
  const used = new Set<string>([params.exclude])
  for (const n of pool) {
    if (used.has(n)) continue
    used.add(n)
    unique.push(n)
    if (unique.length >= params.count) break
  }
  return unique
}
