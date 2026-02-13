import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import Card from './Card'
import { OfflineEngine, getCompareValue, type Difficulty, type EngineAction, type OfflineGameView } from '../offline/engine'
import { deepseekChat, tryParseJsonObject } from '../offline/deepseek'

interface OfflineGameTableProps {
  engine: OfflineEngine
  aiMode: 'local' | 'deepseek'
  deepseekApiKey?: string
  onExit: () => void
}

export default function OfflineGameTable({ engine, aiMode, deepseekApiKey, onExit }: OfflineGameTableProps) {
  const navigate = useNavigate()
  const [gameState, setGameState] = useState<OfflineGameView>(() => engine.getView(engine.humanId))
  const [selectedCards, setSelectedCards] = useState<string[]>([])
  const [isActing, setIsActing] = useState(false)
  const [holeCards, setHoleCards] = useState<any[]>([])
  const [settlement, setSettlement] = useState<{ winnerId: string; winnerSide?: string } | null>(null)
  const [settlementMultiplier, setSettlementMultiplier] = useState<number | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth)
  const [noBeatKey, setNoBeatKey] = useState<string | null>(null)
  const [engineSeq, setEngineSeq] = useState(() => engine.actionSeq || 0)
  const [lastToastSeq, setLastToastSeq] = useState(0)
  const [showAllPlayed, setShowAllPlayed] = useState(false)
  const playAreaRef = useRef<HTMLDivElement>(null)
  const aiBusyRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const myName = useMemo(() => engine.players.find(p => p.id === engine.humanId)?.name || '我', [engine])

  const myHandCount = Array.isArray(gameState?.myHand) ? gameState.myHand.length : 0
  const isNarrow = viewportWidth <= 480
  const useTwoRows = isNarrow && myHandCount > 10
  const cardSizeClass = isNarrow
    ? 'w-[clamp(3.1rem,10vw,4.2rem)] h-[clamp(4.4rem,14vw,6.0rem)]'
    : 'w-20 h-28'

  const myPlayedCards = Array.isArray((gameState as any)?.myPlayedCards) ? (gameState as any).myPlayedCards : []
  const myPlayedMovesRaw = Array.isArray((gameState as any)?.myPlayedMoves) ? (gameState as any).myPlayedMoves : null
  const allPlayedGroups =
    myPlayedMovesRaw && myPlayedMovesRaw.length > 0 ? myPlayedMovesRaw : myPlayedCards.length > 0 ? [{ cards: myPlayedCards }] : []
  const myPlayedMoveGroups =
    showAllPlayed || allPlayedGroups.length <= 80 ? allPlayedGroups : allPlayedGroups.slice(Math.max(0, allPlayedGroups.length - 80))
  const playedPanelWidthClass = isNarrow ? 'w-[clamp(84px,18vw,132px)]' : 'w-[clamp(100px,14vw,164px)]'
  const playedCardSizeClass = isNarrow
    ? 'w-[clamp(18px,5.2vw,26px)] h-[clamp(25px,7.2vw,36px)]'
    : 'w-[clamp(20px,3.2vw,34px)] h-[clamp(28px,4.6vw,46px)]'
  const playedCols = viewportWidth <= 360 ? 4 : viewportWidth <= 480 ? 5 : viewportWidth <= 768 ? 6 : 7
  const playedMax = 70

  const getRankLabel = (rank: number, suit?: string) => {
    if (suit === 'J') return rank >= 17 ? '大王' : '小王'
    if (rank === 11) return 'J'
    if (rank === 12) return 'Q'
    if (rank === 13) return 'K'
    if (rank === 14) return 'A'
    if (rank === 15) return '2'
    return String(rank)
  }

  const showActionToast = (action: EngineAction) => {
    const actorName =
      action.playerId === engine.humanId
        ? myName
        : engine.players.find(p => p.id === action.playerId)?.name || '对手'
    if (action.type === 'bid') {
      const s = typeof action.score === 'number' ? action.score : 0
      const msg = s === 0 ? `${actorName} 不叫` : `${actorName} 叫了 ${s} 分`
      setToast(msg)
      window.setTimeout(() => setToast(null), 1400)
      return
    }
    if (action.type === 'take_hole') {
      setToast(`${actorName} 正在收底牌…`)
      window.setTimeout(() => setToast(null), 1200)
      return
    }
    if (action.type === 'pass') {
      setToast(`${actorName} 不出`)
      window.setTimeout(() => setToast(null), 1000)
      return
    }
    if (action.type === 'undo') {
      setToast(`${actorName} 撤销了上一次出牌`)
      window.setTimeout(() => setToast(null), 1200)
      return
    }
    if (action.type === 'play' && action.isMax) {
      setToast(`${actorName} 出了最大牌，继续出牌`)
      window.setTimeout(() => setToast(null), 1600)
    }
  }

  const canAnyBeat = (hand: any[], lastMove: any) => {
    const p = lastMove?.pattern
    if (!p) return true
    const lastRankValue = getCompareValue(Number(p.rank))
    const counts = new Map<number, number>()
    for (const c of hand || []) {
      const r = Number(c?.rank)
      if (!Number.isFinite(r)) continue
      counts.set(r, (counts.get(r) || 0) + 1)
    }

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
      const length = Number(len)
      if (!Number.isFinite(length) || length < 2) return false
      for (let start = minRank; start <= maxRank - length + 1; start += 1) {
        const end = start + length - 1
        if (end <= Number(p.rank)) continue
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
        return true
    }
  }

  const isMyTurn = gameState?.currentTurn === engine.humanId && gameState?.phase === 'PLAYING'
  const mustFollow = isMyTurn && !!gameState?.lastMove && gameState?.lastMove?.playerId !== engine.humanId
  const canBeatTable = !mustFollow ? true : canAnyBeat(gameState?.myHand || [], gameState?.lastMove)
  const cannotBeatTable = mustFollow && !canBeatTable

  const sync = () => {
    const v = engine.getView(engine.humanId)
    setGameState(v)
    if (v.phase === 'TAKING_HOLE') setHoleCards(Array.isArray(v.holeCards) ? v.holeCards : [])
    else setHoleCards([])
    setEngineSeq(engine.actionSeq || 0)
    const action = engine.lastAction
    if (action && action.seq > lastToastSeq) {
      setLastToastSeq(action.seq)
      showActionToast(action)
    }
  }

  const runDeepSeekBid = async (playerId: string) => {
    if (!deepseekApiKey) throw new Error('Missing DeepSeek API key')
    const hand = (engine.playersHand[playerId] || []).map(c => c.code).sort()
    const bids = engine.bidByPlayer || {}
    const players = engine.players.map(p => ({ id: p.id, name: p.name }))
    const prompt = {
      phase: engine.phase,
      bidScore: engine.bidScore,
      biddingStarterId: engine.biddingStarterId,
      currentTurn: engine.currentTurn,
      players,
      myId: playerId,
      myHand: hand,
      bids,
      rules: {
        scores: [0, 1, 2, 3, 4],
        mustBeHigherThanBidScoreUnlessZero: true,
      },
      output: { bid: '0|1|2|3|4' },
    }

    const content = await deepseekChat({
      apiKey: deepseekApiKey,
      model: 'deepseek-chat',
      temperature: 0.2,
      maxTokens: 120,
      messages: [
        {
          role: 'system',
          content: 'You are an AI player for a card game. Output ONLY valid JSON. No extra text.',
        },
        { role: 'user', content: JSON.stringify(prompt) },
      ],
      signal: abortRef.current?.signal,
    })

    const obj = tryParseJsonObject(content)
    const bid = Number(obj?.bid)
    if (![0, 1, 2, 3, 4].includes(bid)) throw new Error('DeepSeek invalid bid')
    return bid
  }

  const runDeepSeekMove = async (playerId: string) => {
    if (!deepseekApiKey) throw new Error('Missing DeepSeek API key')
    const hand = (engine.playersHand[playerId] || []).map(c => c.code).sort()
    const lastMove = engine.lastMove
      ? {
          playerId: engine.lastMove.playerId,
          cards: engine.lastMove.cards.map(c => c.code),
          pattern: engine.lastMove.pattern,
        }
      : null
    const mustFollow = !!lastMove && lastMove.playerId !== playerId
    const prompt = {
      phase: engine.phase,
      currentTurn: engine.currentTurn,
      myId: playerId,
      myHand: hand,
      lastMove,
      mustFollow,
      rules: {
        cannotPassWhenFreePlay: true,
        sequencesMaxRank: 'K(13)',
        sequencesCannotContainA: true,
        consecutivePairsMinPairs: 3,
        allowedPlays: {
          single: '单张：任意 1 张',
          pair: '对子：2 张同点数',
          triplet: '三张：3 张同点数',
          quad: '四个：4 张同点数',
          straight: '顺子：连续点数，至少 3 张，最大只能到 K，不允许包含 A/2',
          consecutivePairs: '对子顺：连续对子，至少 3 个对子(6张)，最大只能到 K，不允许包含 A/2',
          consecutiveTriplets: '三个顺：连续三张，至少 2 组(6张)，如 444555，最大只能到 K，不允许包含 A/2',
        },
        preference: {
          whenFreePlayPrefer: '尽量不要总是出单牌；在不违规的前提下优先考虑出对子/三张/顺子/对子顺/三个顺来减少手牌',
          whenFollowingPrefer: '用能压过的最小牌型跟牌；若没有可压则 pass',
        },
      },
      output: {
        action: 'play|pass',
        cards: ['array of card codes when action=play'],
      },
    }

    const content = await deepseekChat({
      apiKey: deepseekApiKey,
      model: 'deepseek-chat',
      temperature: 0.2,
      maxTokens: 200,
      messages: [
        {
          role: 'system',
          content:
            '你是扑克游戏的AI玩家。严格遵守规则并只输出合法JSON，不要输出任何解释文字。必须输出 {"action":"pass"} 或 {"action":"play","cards":["H4","D4"]}。free play 时不要总出单牌，优先尝试能一次出更多牌的合法牌型。',
        },
        { role: 'user', content: JSON.stringify(prompt) },
      ],
      signal: abortRef.current?.signal,
    })

    const obj = tryParseJsonObject(content)
    const action = obj?.action
    const cards = Array.isArray(obj?.cards) ? obj.cards.map((x: any) => String(x)) : []
    if (action !== 'play' && action !== 'pass') throw new Error('DeepSeek invalid action')
    return { action, cards }
  }

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    sync()
  }, [])

  useEffect(() => {
    if (gameState.phase === 'FINISHED' && !settlement?.winnerId && gameState.winnerId) {
      setSettlement({ winnerId: gameState.winnerId, winnerSide: gameState.winnerSide })
      setSettlementMultiplier(null)
      setSelectedCards([])
    }
    if (gameState.phase !== 'FINISHED' && settlement?.winnerId) {
      setSettlement(null)
      setSettlementMultiplier(null)
    }
  }, [gameState, settlement?.winnerId])

  useEffect(() => {
    if (engine.roomStatus !== 'PLAYING') return
    if (engine.phase === 'FINISHED') return
    if (engine.currentTurn === engine.humanId) return
    if (aiBusyRef.current) return
    aiBusyRef.current = true
    const rand = (min: number, max: number) => Math.floor(min + Math.random() * (max - min + 1))
    const baseDelay =
      engine.phase === 'TAKING_HOLE'
        ? 3000
        : engine.phase === 'BIDDING'
          ? rand(900, 1400)
          : rand(850, 1350)
    const t = window.setTimeout(() => {
      try {
        const aiId = engine.currentTurn
        if (aiMode === 'deepseek') {
          abortRef.current?.abort()
          abortRef.current = new AbortController()
          setToast('AI 思考中…')
          const phase = engine.phase
          ;(async () => {
            try {
              if (phase === 'BIDDING') {
                const bid = await runDeepSeekBid(aiId)
                engine.bid(aiId, bid)
              } else if (phase === 'TAKING_HOLE') {
                if (engine.diggerId === aiId) engine.takeHole(aiId)
              } else if (phase === 'PLAYING') {
                const move = await runDeepSeekMove(aiId)
                if (move.action === 'pass') engine.pass(aiId)
                else engine.playCards(aiId, move.cards)
              }
            } catch {
              try {
                engine.aiStep(aiId)
              } catch {
              }
            } finally {
              setToast(null)
              sync()
            }
          })()
        } else {
          engine.aiStep(aiId)
          sync()
        }
      } catch {
      } finally {
        aiBusyRef.current = false
      }
    }, baseDelay)
    return () => {
      window.clearTimeout(t)
      abortRef.current?.abort()
      abortRef.current = null
      aiBusyRef.current = false
    }
  }, [engineSeq])

  useEffect(() => {
    if (!cannotBeatTable) return
    const p = (gameState as any)?.lastMove?.pattern
    const key = `${(gameState as any)?.roomId || ''}:${engine.humanId}:${(gameState as any)?.currentTurn || ''}:${p?.type || ''}:${p?.rank || ''}:${p?.length || ''}`
    if (noBeatKey === key) return
    setNoBeatKey(key)
    setToast('当前无牌可压，请选择“不出”')
    window.setTimeout(() => setToast(null), 1800)
  }, [cannotBeatTable, engine.humanId, gameState, noBeatKey])

  const toggleCard = (code: string) => {
    setSelectedCards(prev => (prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]))
  }

  const handleBid = async (score: number) => {
    if (isActing) return
    setIsActing(true)
    try {
      engine.bid(engine.humanId, score)
      sync()
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    } finally {
      setIsActing(false)
    }
  }

  const handleTakeHole = async () => {
    if (isActing) return
    setIsActing(true)
    try {
      setToast('正在收底牌…')
      await new Promise<void>(resolve => window.setTimeout(resolve, 3000))
      engine.takeHole(engine.humanId)
      sync()
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
      sync()
    } finally {
      setIsActing(false)
    }
  }

  const handlePlay = async (cardsToPlay: string[] = selectedCards) => {
    if (cardsToPlay.length === 0) return alert('请选择要出的牌')
    if (cannotBeatTable) {
      setToast('当前无牌可压，请选择“不出”')
      window.setTimeout(() => setToast(null), 1800)
      return
    }
    if (isActing) return
    setIsActing(true)
    try {
      engine.playCards(engine.humanId, cardsToPlay)
      setSelectedCards([])
      sync()
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
      sync()
    } finally {
      setIsActing(false)
    }
  }

  const handlePass = async () => {
    if (isActing) return
    setIsActing(true)
    try {
      engine.pass(engine.humanId)
      setSelectedCards([])
      sync()
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    } finally {
      setIsActing(false)
    }
  }

  const handleUndo = async () => {
    if (isActing) return
    setIsActing(true)
    try {
      engine.undoLastMove(engine.humanId)
      setSelectedCards([])
      sync()
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    } finally {
      setIsActing(false)
    }
  }

  const handleNextRound = async () => {
    if (isActing) return
    setIsActing(true)
    try {
      engine.startGame()
      setSettlement(null)
      setSelectedCards([])
      setHoleCards([])
      sync()
    } finally {
      setIsActing(false)
    }
  }

  const handleConfirmSettlement = async () => {
    try {
      onExit()
    } catch {
      navigate('/')
    }
  }

  const winnerName = settlement?.winnerId
    ? settlement.winnerId === engine.humanId
      ? myName
      : gameState.otherPlayers.find((p: any) => p.id === settlement.winnerId)?.name || '玩家'
    : ''
  const isDiggerWin = settlement?.winnerSide
    ? settlement.winnerSide === 'DIGGER'
    : settlement?.winnerId
      ? settlement.winnerId === gameState.diggerId
      : false

  const handleDragEnd = (_event: any, info: any, cardCode: string) => {
    if (info.offset.y < -150) {
      if (cannotBeatTable) {
        setToast('当前无牌可压，请选择“不出”')
        window.setTimeout(() => setToast(null), 1800)
        return
      }
      let cardsToPlay = [...selectedCards]
      if (!cardsToPlay.includes(cardCode)) {
        cardsToPlay = [cardCode]
        setSelectedCards([cardCode])
      }
      handlePlay(cardsToPlay)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-[#1a472a] overflow-hidden relative select-none">
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '20px 20px' }}
      />

      <div className="flex justify-between p-4 z-10 text-white/90 text-sm md:text-base shadow-sm bg-black/10 backdrop-blur-sm">
        <div>
          <div className="font-bold text-lg text-yellow-100 drop-shadow-md">
            阶段：
            <span className="text-white">
              {gameState.phase === 'BIDDING'
                ? '叫分'
                : gameState.phase === 'TAKING_HOLE'
                  ? '收底牌'
                  : gameState.phase === 'FINISHED'
                    ? '结算'
                    : '出牌'}
            </span>
          </div>
          {gameState.diggerId && (
            <div className="flex items-center gap-1 text-yellow-400">
              <span>👑 坑主:</span>
              <span>
                {gameState.otherPlayers.find((p: any) => p.id === gameState.diggerId)?.name ||
                  (gameState.diggerId === engine.humanId ? myName : '未知')}
              </span>
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-[11px] text-white/70 mb-1">离线模式</div>
          <button
            onClick={onExit}
            className="mb-1 text-xs bg-red-600/80 hover:bg-red-700 text-white px-2 py-1 rounded"
          >
            退出
          </button>
          <div>
            底分: <span className="font-mono text-yellow-300">{gameState.bidScore}</span>
          </div>
          <div className="font-bold flex items-center gap-2">
            {gameState.currentTurn === engine.humanId ? (
              <span className="text-green-300 animate-pulse">👉 你的回合</span>
            ) : (
              <span className="text-gray-300">
                等待 {gameState.otherPlayers.find((p: any) => p.id === gameState.currentTurn)?.name || '他人'}...
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-around py-4 z-10">
        {gameState.otherPlayers.map((p: any) => (
          <div
            key={p.id}
            className={`
              relative p-3 rounded-xl min-w-[80px] text-center transition-all duration-300
              ${gameState.currentTurn === p.id ? 'bg-yellow-500/20 border-2 border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.3)]' : 'bg-black/20 border border-white/10'}
          `}
          >
            <div className="font-bold text-white text-sm">
              {p.id === gameState.diggerId && '👑 '}
              {p.name}
            </div>
            <div className="flex justify-center items-center gap-1 mt-1">
              <div className="bg-blue-600 w-5 h-7 rounded-sm border border-white/20" />
              <span className="text-xl font-mono text-white">{p.cardCount}</span>
            </div>
            {gameState.phase === 'BIDDING' && (
              <div className="mt-1 text-[11px] text-white/80">
                叫分：
                {gameState.bidByPlayer?.[p.id] == null
                  ? '未叫'
                  : gameState.bidByPlayer[p.id] === 0
                    ? '不叫'
                    : `${gameState.bidByPlayer[p.id]}分`}
              </div>
            )}
          </div>
        ))}
      </div>

      <div ref={playAreaRef} className="flex-grow flex flex-col items-center justify-center relative z-0 pb-[320px] md:pb-[280px]">
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-6 z-40 px-4 py-2 rounded-full bg-black/60 text-white text-sm backdrop-blur border border-white/10 shadow-xl"
            >
              {toast}
            </motion.div>
          )}
        </AnimatePresence>

        {myPlayedMoveGroups.length > 0 && (
          <div className={`absolute left-2 top-20 z-20 ${playedPanelWidthClass}`}>
            <button
              type="button"
              onClick={() => setShowAllPlayed(v => !v)}
              className="w-full text-left text-[11px] text-white/70 bg-black/30 px-2 py-1 rounded-lg backdrop-blur border border-white/10 hover:bg-black/40 active:bg-black/50"
            >
              {myPlayedMovesRaw ? `已出：${myPlayedMovesRaw.length}手 / ${myPlayedCards.length}张` : `已出：${myPlayedCards.length}张`}
              {allPlayedGroups.length > 80 ? (
                <span className="ml-2 text-white/60">{showAllPlayed ? '收起' : `查看更早(${allPlayedGroups.length - 80})`}</span>
              ) : null}
            </button>
            <div className="mt-2 overflow-auto pr-1" style={{ maxHeight: isNarrow ? '34vh' : '40vh' }}>
              <div className="flex flex-col gap-2">
                {[...myPlayedMoveGroups].reverse().map((m: any, groupIndex: number) => (
                  <div
                    key={(m?.cards || []).map((c: any) => c.code).join(',') + String(groupIndex)}
                    className="grid gap-0"
                    style={{ gridTemplateColumns: `repeat(${playedCols}, minmax(0, 1fr))` }}
                  >
                    {(m?.cards || []).map((c: any) => (
                      <div key={c.code} className="flex items-start justify-start">
                        <div
                          className={[
                            playedCardSizeClass,
                            'rounded-[6px] border border-white/10 bg-white/90 flex items-center justify-center font-extrabold',
                            c?.suit === 'H' || c?.suit === 'D' ? 'text-red-600' : 'text-slate-900',
                          ].join(' ')}
                        >
                          <span className={isNarrow ? 'text-[11px] leading-none' : 'text-[12px] leading-none'}>
                            {getRankLabel(Number(c?.rank), String(c?.suit || ''))}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-full h-2/3 border-2 border-dashed border-white/10 rounded-3xl m-8" />
        </div>

        <AnimatePresence>
          {holeCards.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-4 flex gap-1"
            >
              {holeCards.map((c: any) => (
                <div key={c.code} className="transform scale-75 origin-top">
                  <Card code={c.code} />
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="text-white/20 mb-4 font-bold tracking-widest uppercase">{gameState.lastMove ? 'Last Played' : 'Table'}</div>

        <AnimatePresence mode="wait">
          {gameState.lastMove ? (
            <motion.div
              key={gameState.lastMove.playerId + gameState.lastMove.cards.map((c: any) => c.code).join('')}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="flex flex-col items-center"
            >
              <div className="text-sm mb-2 text-white/80 bg-black/30 px-3 py-1 rounded-full">
                {gameState.lastMove.playerId === engine.humanId
                  ? myName
                  : gameState.otherPlayers.find((p: any) => p.id === gameState.lastMove.playerId)?.name || 'Player'}
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {gameState.lastMove.cards.map((c: any) => (
                  <motion.div key={c.code} initial={{ x: 20 }} animate={{ x: 0 }}>
                    <Card code={c.code} />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ) : (
            <div className="text-white/30 text-sm">等待出牌...</div>
          )}
        </AnimatePresence>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-black/70 to-transparent pb-safe">
        {selectedCards.length > 0 && (
          <div className="px-4 pt-2">
            <div className="text-white/70 text-xs mb-2">已选牌</div>
            <div className={`w-full ${useTwoRows ? '' : 'overflow-x-auto'}`}>
              <div className={`${useTwoRows ? 'flex flex-wrap justify-center gap-2 pb-2' : 'flex gap-2 min-w-max pb-2 px-2 justify-center'}`}>
                {gameState.myHand
                  .filter((c: any) => selectedCards.includes(c.code))
                  .map((card: any) => (
                    <motion.div
                      key={card.code}
                      layoutId={card.code}
                      drag
                      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                      dragElastic={0.2}
                      dragSnapToOrigin={true}
                      onDragEnd={(e, info) => handleDragEnd(e, info, card.code)}
                      onClick={() => toggleCard(card.code)}
                      whileHover={{ y: -6, zIndex: 3000 }}
                      whileDrag={{ scale: 1.05, zIndex: 3000, cursor: 'grabbing' }}
                      className="cursor-grab active:cursor-grabbing"
                    >
                      <Card code={card.code} className={`shadow-2xl ${cardSizeClass}`} />
                    </motion.div>
                  ))}
              </div>
            </div>
          </div>
        )}

        <div className={`w-full ${useTwoRows ? '' : 'overflow-x-auto'} pb-2 pt-2 px-4 min-h-[110px]`}>
          <AnimatePresence>
            <div className={`${useTwoRows ? 'flex flex-wrap justify-center gap-2' : 'flex gap-2 min-w-max px-2 justify-center'}`}>
              {gameState.myHand
                .filter((c: any) => !selectedCards.includes(c.code))
                .map((card: any) => (
                  <motion.div
                    key={card.code}
                    layoutId={card.code}
                    drag
                    dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                    dragElastic={0.2}
                    dragSnapToOrigin={true}
                    onDragEnd={(e, info) => handleDragEnd(e, info, card.code)}
                    onClick={() => toggleCard(card.code)}
                    whileHover={{ y: -6, zIndex: 3000 }}
                    whileDrag={{ scale: 1.05, zIndex: 3000, cursor: 'grabbing' }}
                    className="cursor-grab active:cursor-grabbing"
                  >
                    <Card code={card.code} selected={false} className={`shadow-2xl ${cardSizeClass}`} />
                  </motion.div>
                ))}
            </div>
          </AnimatePresence>
        </div>

        <div className="px-4 pb-6 pt-2 flex justify-center">
          {gameState.currentTurn === engine.humanId ? (
            gameState.phase === 'BIDDING' ? (
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex gap-3">
                {[0, 1, 2, 3, 4].map(score => (
                  <button
                    key={score}
                    disabled={isActing}
                    onClick={() => handleBid(score)}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-full shadow-lg active:scale-95 transition-all disabled:opacity-50"
                  >
                    {score === 0 ? '不叫' : score}
                  </button>
                ))}
              </motion.div>
            ) : gameState.phase === 'TAKING_HOLE' ? (
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex gap-4">
                <button
                  disabled={isActing}
                  onClick={handleTakeHole}
                  className="px-8 py-3 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-full shadow-lg active:scale-95 transition-all disabled:opacity-50"
                >
                  收底牌
                </button>
              </motion.div>
            ) : gameState.phase === 'PLAYING' ? (
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex gap-4">
                <button
                  disabled={isActing || cannotBeatTable}
                  onClick={() => handlePlay()}
                  className="px-8 py-3 bg-gradient-to-b from-yellow-400 to-yellow-600 text-yellow-950 font-bold rounded-full shadow-lg hover:shadow-yellow-500/50 active:scale-95 transition-all border border-yellow-300 disabled:opacity-50"
                >
                  出牌
                </button>
                <button
                  disabled={isActing}
                  onClick={handlePass}
                  className="px-8 py-3 bg-slate-600 text-white font-bold rounded-full shadow-lg hover:bg-slate-500 active:scale-95 transition-all border border-slate-500 disabled:opacity-50"
                >
                  不出
                </button>
                <button
                  disabled={isActing}
                  onClick={handleUndo}
                  className="px-5 py-3 bg-white/10 text-white font-bold rounded-full shadow-lg hover:bg-white/15 active:scale-95 transition-all border border-white/10 disabled:opacity-50"
                >
                  撤销
                </button>
              </motion.div>
            ) : null
          ) : (
            <div className="text-white/70 text-sm">等待其他玩家操作…</div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {settlement?.winnerId && settlementMultiplier === null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          >
            <div className="w-full max-w-md mx-4 rounded-3xl bg-white/95 shadow-2xl p-6">
              <div className="text-2xl font-extrabold text-slate-900 mb-2">选择本局翻倍</div>
              <div className="text-slate-700 mb-6">选择后进入结算。</div>
              <div className="grid grid-cols-4 gap-3">
                {[1, 2, 4, 8].map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setSettlementMultiplier(m)}
                    className="w-full rounded-2xl bg-slate-900 hover:bg-slate-950 text-white font-extrabold py-3 text-lg"
                  >
                    x{m}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
        {settlement?.winnerId && settlementMultiplier !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          >
            <div className="w-full max-w-md mx-4 rounded-3xl bg-white/95 shadow-2xl p-6">
              <div className="text-2xl font-extrabold text-slate-900 mb-3">本局结束</div>
              <div className="text-slate-700 mb-2">
                翻倍：<span className="font-bold text-slate-900">x{settlementMultiplier}</span>
              </div>
              <div className="text-slate-700 mb-2">
                胜者：<span className="font-bold text-slate-900">{winnerName}</span>
              </div>
              <div className={`mb-6 font-bold ${isDiggerWin ? 'text-purple-700' : 'text-green-700'}`}>
                胜方：{isDiggerWin ? '坑主方' : '对抗方'}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  disabled={isActing}
                  onClick={handleNextRound}
                  className="w-full rounded-2xl bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-3 text-lg"
                >
                  再来一局
                </button>
                <button
                  disabled={isActing}
                  onClick={handleConfirmSettlement}
                  className="w-full rounded-2xl bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-bold py-3 text-lg"
                >
                  返回
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
