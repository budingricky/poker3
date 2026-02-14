import { GameState } from '../models/gameTypes.js';

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

export type Phase = 'BIDDING' | 'TAKING_HOLE' | 'PLAYING' | 'ENDING' | 'FINISHED'
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

export interface EngineAction {
  seq: number
  type: string
  playerId: string
  score?: number
  isMax?: boolean
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
  readonly hostId: string = ''
  readonly humanId: string = ''
  readonly difficulty: Difficulty = 'hard' // Default to hard for server bot

  players: OfflinePlayer[] = []
  roomStatus: 'WAITING' | 'PLAYING' | 'FINISHED' = 'PLAYING'

  phase: Phase = 'BIDDING'
  deck: Card[] = []
  holeCards: Card[] = []
  initialHoleCards: Card[] = []
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

  // Empty methods to satisfy structure used by MCTSEngine
  pass(pid: string) { this.passCount++ }
  playCards(pid: string, codes: string[]) {}
  bid(pid: string, score: number) {}
  takeHole(pid: string) {}
}

class MCTSNode {
  children: Map<string, MCTSNode> = new Map()
  visits: number = 0
  wins: number = 0 
  
  constructor(
    public parent: MCTSNode | null = null,
    public move: Card[] | null = null,
    public playerId: string 
  ) {}

  get UCB1(): number {
    if (this.visits === 0) return Infinity
    return this.wins / this.visits + 1.414 * Math.sqrt(Math.log(this.parent!.visits) / this.visits)
  }
}

class MCTSEngine {
  constructor(private rootEngine: OfflineEngine, private myPlayerId: string) {}

  async run(timeoutMs: number): Promise<Card[]> {
    const rootNode = new MCTSNode(null, null, '')
    const startTime = Date.now()
    let iterations = 0

    const allCards = this.getAllCards()
    const myHand = this.rootEngine.playersHand[this.myPlayerId] || []
    const playedCards = Object.values(this.rootEngine.playedCardsByPlayer).flat()
    const knownCodes = new Set([...myHand.map(c => c.code), ...playedCards.map(c => c.code)])
    const unknownCards = allCards.filter(c => !knownCodes.has(c.code))
    
    const opponentCounts: Record<string, number> = {}
    for (const p of this.rootEngine.players) {
        if (p.id !== this.myPlayerId) {
            opponentCounts[p.id] = (this.rootEngine.playersHand[p.id] || []).length
        }
    }

    while (Date.now() - startTime < timeoutMs) {
      iterations++
      // Yield to event loop every 100 iterations to prevent server blocking
      if (iterations % 100 === 0) {
          await new Promise(resolve => setImmediate(resolve))
      }

      const determinizedState = this.determinize(myHand, unknownCards, opponentCounts)
      
      let node = rootNode
      let state = determinizedState

      while (true) {
        const legalMoves = this.getLegalMoves(state, state.currentTurn)
        if (state.roomStatus === 'FINISHED') break

        const untried = legalMoves.filter(m => !node.children.has(this.getMoveKey(m)))
        
        if (untried.length > 0) {
          const move = untried[Math.floor(Math.random() * untried.length)]
          const moveKey = this.getMoveKey(move)
          const mover = state.currentTurn
          this.applyMove(state, mover, move)
          const child = new MCTSNode(node, move, mover)
          node.children.set(moveKey, child)
          node = child
          break
        } else {
          const validChildren = legalMoves
            .map(m => node.children.get(this.getMoveKey(m)))
            .filter((n): n is MCTSNode => !!n)

          if (validChildren.length === 0) break 
          
          // UCB1 selection with slight exploration bias for robustness
          node = validChildren.reduce((a, b) => a.UCB1 > b.UCB1 ? a : b)
          
          // Safety break to prevent infinite loops in edge cases
          if (!node || !node.move) break
          
          this.applyMove(state, node.playerId, node.move)
        }
      }

      this.simulate(state)

      const amIWinner = state.winnerId === this.myPlayerId || 
        (state.winnerSide && state.winnerSide === (this.rootEngine.diggerId === this.myPlayerId ? 'DIGGER' : 'OTHERS'))
      
      let curr: MCTSNode | null = node
      while (curr) {
        curr.visits++
        const nodePlayerWon = state.winnerId === curr.playerId ||
            (state.winnerSide && state.winnerSide === (this.rootEngine.diggerId === curr.playerId ? 'DIGGER' : 'OTHERS'))
        if (nodePlayerWon) curr.wins++
        curr = curr.parent
      }
    }
    
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
      const shuffled = [...unknownCards]
      for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }
      let idx = 0
      for (const pid in opponentCounts) {
          const count = opponentCounts[pid]
          state.playersHand[pid] = sortCards(shuffled.slice(idx, idx + count))
          idx += count
      }
      return state
  }

  private cloneEngine(source: OfflineEngine): OfflineEngine {
      const clone = Object.create(Object.getPrototypeOf(source))
      Object.assign(clone, source)
      clone.playersHand = { ...source.playersHand }
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
          engine.passCount++
      } else {
          const hand = engine.playersHand[playerId] || []
          const cardCodes = new Set(cards.map(c => c.code))
          engine.playersHand[playerId] = hand.filter(c => !cardCodes.has(c.code))
          
          const pattern = analyzeHand(cards)!
          engine.lastMove = { playerId, cards, pattern }
          engine.passCount = 0
          
          if (engine.playersHand[playerId].length === 0) {
              engine.roomStatus = 'FINISHED'
              engine.winnerId = playerId
              if (engine.diggerId) engine.winnerSide = engine.diggerId === playerId ? 'DIGGER' : 'OTHERS'
              return
          }
          
           if (this.isMax(engine, cards, pattern)) {
               engine.currentTurn = playerId
               return
           }
      }
      
      const idx = engine.players.findIndex(p => p.id === playerId)
      let nextIdx = (idx + 1) % engine.players.length
      engine.currentTurn = engine.players[nextIdx].id
      
      if (cards.length === 0) {
          if (engine.passCount >= engine.players.length - 1 && engine.lastMove) {
              engine.currentTurn = engine.lastMove.playerId
              engine.lastMove = null
              engine.passCount = 0
          }
      }
  }

  private isMax(engine: OfflineEngine, cards: Card[], pattern: HandPattern): boolean {
      if (pattern.type === 'SINGLE' || pattern.type === 'PAIR' || pattern.type === 'TRIPLET' || pattern.type === 'QUAD') {
          return pattern.rank === 3 
      }
      if (['STRAIGHT', 'CONSECUTIVE_PAIRS', 'CONSECUTIVE_TRIPLETS'].includes(pattern.type)) {
          return pattern.rank === 13 
      }
      return false
  }

  private simulate(state: OfflineEngine) {
      let depth = 0
      const maxDepth = 60
      
      while (state.roomStatus === 'PLAYING' && depth < maxDepth) {
          const pid = state.currentTurn
          const legal = this.getLegalMoves(state, pid)
          
          if (legal.length === 0) {
              this.applyMove(state, pid, [])
          } else {
              // Heuristic Simulation Policy:
              // 1. If can win immediately, do it.
              const winningMove = legal.find(m => {
                  const hand = state.playersHand[pid] || []
                  return m.length === hand.length
              })
              
              if (winningMove) {
                  this.applyMove(state, pid, winningMove)
              } else {
                  // 2. Prefer combos over singles to empty hand faster
                  // 3. Avoid breaking high value cards (Jokers/2s) for weak plays if possible
                  // Weighted random selection based on move quality
                  
                  const weightedMoves = legal.map(m => {
                      let weight = 1
                      const pattern = analyzeHand(m)!
                      
                      // Prefer playing more cards
                      weight += m.length * 2
                      
                      // Prefer combos
                      if (['STRAIGHT', 'CONSECUTIVE_PAIRS', 'CONSECUTIVE_TRIPLETS'].includes(pattern.type)) {
                          weight += 5
                      }
                      
                      // Penalize breaking high cards for single plays
                      if (pattern.type === 'SINGLE') {
                          if (pattern.rank >= 15) weight = 0.1 // Avoid playing 2/Joker as single in simulation unless forced
                          else weight = 0.5
                      }
                      
                      return { move: m, weight }
                  })
                  
                  // Select based on weight
                  const totalWeight = weightedMoves.reduce((sum, item) => sum + item.weight, 0)
                  let r = Math.random() * totalWeight
                  let chosen = legal[0]
                  
                  for (const item of weightedMoves) {
                      r -= item.weight
                      if (r <= 0) {
                          chosen = item.move
                          break
                      }
                  }
                  
                  this.applyMove(state, pid, chosen)
              }
          }
          depth++
      }
  }
}

export async function computeAiPlayMove(game: GameState, myPlayerId: string, playerIds: string[]): Promise<Card[]> {
    const engine = new OfflineEngine()
    
    // Hydrate
    engine.players = playerIds.map(id => ({ id, name: 'bot', isOnline: true, isHuman: false }))
    engine.playersHand = JSON.parse(JSON.stringify(game.playersHand)) as Record<string, Card[]>
    engine.playedCardsByPlayer = JSON.parse(JSON.stringify(game.playedCardsByPlayer)) as Record<string, Card[]>
    engine.playedMovesByPlayer = JSON.parse(JSON.stringify(game.playedMovesByPlayer)) as Record<string, PlayedMove[]>
    
    engine.currentTurn = game.currentTurn
    engine.phase = game.phase
    engine.bidScore = game.bidScore
    engine.diggerId = game.diggerId
    engine.passCount = game.passCount
    engine.lastMove = game.lastMove ? JSON.parse(JSON.stringify(game.lastMove)) : null
    engine.deck = game.deck // hole cards if any
    
    const mcts = new MCTSEngine(engine, myPlayerId)
    // Hard mode: 2000ms with async yielding
    return await mcts.run(2000)
}

export function computeAiBid(game: GameState, myPlayerId: string): number {
    const hand = game.playersHand[myPlayerId] || []
    const strength = hand.reduce((acc, c) => acc + getCompareValue(c.rank), 0)
    const base = strength / Math.max(1, hand.length)
    
    // Improved Bidding Logic
    // Evaluate distribution
    const counts = new Map<number, number>()
    let maxRankCount = 0
    let twoCount = 0
    let jokerCount = 0
    
    for (const c of hand) {
        counts.set(c.rank, (counts.get(c.rank) || 0) + 1)
        if (c.rank === 15) twoCount++
        if (c.rank >= 16) jokerCount++
    }
    
    // Basic point system
    let scorePoints = 0
    scorePoints += jokerCount * 4 // Jokers are very valuable
    scorePoints += twoCount * 2 // 2s are valuable
    scorePoints += (counts.get(14) || 0) * 1 // Aces
    scorePoints += (counts.get(13) || 0) * 0.5 // Kings
    
    // Bomb bonus
    for (const count of counts.values()) {
        if (count === 4) scorePoints += 3
    }
    
    let want = 0
    if (scorePoints > 12) want = 3
    else if (scorePoints > 8) want = 2
    else if (scorePoints > 5) want = 1
    
    // Aggressive AI
    if (Math.random() > 0.7) want += 1
    
    // Ensure we bid higher than current if we want to
    const currentMax = game.bidScore
    if (want <= currentMax) {
        // If we really have good cards (want >= 3), maybe push to 3
        if (want >= 3 && currentMax < 3) return 3
        return 0 // Pass if we can't beat current effectively or hand isn't super strong
    }
    
    return Math.min(3, want) // Cap at 3 for safety unless 4 is allowed? Game logic allows 4? UI shows 1-4.
    // Let's return valid bid
    const validBids = [1, 2, 3, 4].filter(b => b > currentMax)
    if (validBids.length === 0) return 0
    
    // Find closest valid bid to 'want'
    // If want is 3, valid are [4], we might not bid 4 unless want was 4.
    // If want >= valid[0], return valid[0]
    for (const b of validBids) {
        if (want >= b) return b
    }
    return 0
}
