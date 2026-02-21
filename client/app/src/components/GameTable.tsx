import React, { useCallback, useEffect, useState, useRef } from 'react';
import { api } from '../services/api';
import Card from './Card';
import { socket } from '../services/socket';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useEnsureRoomSocket } from '../hooks/useEnsureRoomSocket'
import { useTRTC } from '../hooks/useTRTC';
import VoicePanel from './VoicePanel';

interface GameTableProps {
  roomId: string;
  playerId: string;
}

export default function GameTable({ roomId, playerId }: GameTableProps) {
  const [gameState, setGameState] = useState<any>(null);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [isActing, setIsActing] = useState(false);
  const [wsReadyState, setWsReadyState] = useState<number | null>(null);
  const [holeCards, setHoleCards] = useState<any[]>([]);
  const [settlement, setSettlement] = useState<{ winnerId: string; winnerSide?: string } | null>(null);
  const [finalSettlement, setFinalSettlement] = useState<{
    initiatedBy: string;
    confirmedPlayers: string[];
  } | null>(null);
  const [handOrder, setHandOrder] = useState<string[]>([]);
  const [settingMultiplier, setSettingMultiplier] = useState<number | null>(null)
  const [toast, setToast] = useState<string | null>(null);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [noBeatKey, setNoBeatKey] = useState<string | null>(null);
  const [showAllPlayed, setShowAllPlayed] = useState(false)
  const [cardOverlap, setCardOverlap] = useState(0)
  const handContainerRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate();
  const playAreaRef = useRef<HTMLDivElement>(null);
  const myName = localStorage.getItem('playerName') || '我';
  const isLoadingRef = useRef(false);
  const gameStateRef = useRef<any>(null);
  const myNameRef = useRef(myName);
  const refreshTimerRef = useRef<number | null>(null);
  const lastFetchAtRef = useRef<number>(0);
  const myHandCount = Array.isArray(gameState?.myHand) ? gameState.myHand.length : 0
  const isNarrow = viewportWidth <= 480
  const useTwoRows = (isNarrow && myHandCount > 10) || (cardOverlap < -20)
  const cardSizeClass = isNarrow
    ? 'w-[clamp(3.1rem,10vw,4.2rem)] h-[clamp(4.4rem,14vw,6.0rem)]'
    : 'w-20 h-28'
  const myPlayedCards = Array.isArray(gameState?.myPlayedCards) ? gameState.myPlayedCards : []
  const myPlayedMovesRaw = Array.isArray(gameState?.myPlayedMoves) ? gameState.myPlayedMoves : null
  const allPlayedGroups =
    myPlayedMovesRaw && myPlayedMovesRaw.length > 0 ? myPlayedMovesRaw : myPlayedCards.length > 0 ? [{ cards: myPlayedCards }] : []
  const myPlayedMoveGroups =
    showAllPlayed || allPlayedGroups.length <= 80 ? allPlayedGroups : allPlayedGroups.slice(Math.max(0, allPlayedGroups.length - 80))
  const playedPanelWidthClass = isNarrow ? 'w-[clamp(84px,18vw,132px)]' : 'w-[clamp(100px,14vw,164px)]'
  const playedCardSizeClass = isNarrow
    ? 'w-[clamp(18px,5.2vw,26px)] h-[clamp(25px,7.2vw,36px)]'
    : 'w-[clamp(20px,3.2vw,34px)] h-[clamp(28px,4.6vw,46px)]'
  const playedCols = viewportWidth <= 360 ? 4 : viewportWidth <= 480 ? 5 : viewportWidth <= 768 ? 6 : 7
  useEnsureRoomSocket(roomId, playerId)
  const voice = useTRTC(roomId, playerId)

  useEffect(() => {
    gameStateRef.current = gameState
    myNameRef.current = myName
  }, [gameState, myName])

  const getRankLabel = (rank: number, suit?: string) => {
    if (suit === 'J') return rank >= 17 ? '大王' : '小王'
    if (rank === 11) return 'J'
    if (rank === 12) return 'Q'
    if (rank === 13) return 'K'
    if (rank === 14) return 'A'
    if (rank === 15) return '2'
    return String(rank)
  }

  const getCompareValue = (rank: number) => {
    if (rank === 3) return 13
    if (rank === 15) return 12
    if (rank === 14) return 11
    return rank - 4
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
      const lastRankValue = getCompareValue(Number(p.rank))
      for (let start = minRank; start <= maxRank - length + 1; start += 1) {
        const end = start + length - 1
        const endRankValue = getCompareValue(end)
        if (endRankValue <= lastRankValue) continue
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

    switch (String(p.type)) {
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

  const isMyTurn = gameState?.currentTurn === playerId && gameState?.phase === 'PLAYING'
  const mustFollow = isMyTurn && !!gameState?.lastMove && gameState?.lastMove?.playerId !== playerId
  const canBeatTable = !mustFollow ? true : canAnyBeat(gameState?.myHand || [], gameState?.lastMove)
  const cannotBeatTable = mustFollow && !canBeatTable

  const sortHandBySuitAndRank = (hand: any[]): any[] => {
    const suitOrder: Record<string, number> = { 'S': 0, 'H': 1, 'C': 2, 'D': 3, 'J': 4 };

    const getSuit = (card: any) => String(card?.suit || card?.code?.[0] || '');
    const rankPriority = new Map<number, number>([
      [3, 0],
      [15, 1],
      [14, 2],
      [13, 3],
      [12, 4],
      [11, 5],
      [10, 6],
      [9, 7],
      [8, 8],
      [7, 9],
      [6, 10],
      [5, 11],
      [4, 12],
    ]);

    const getRank = (card: any) => {
      if (typeof card?.rank === 'number') return card.rank;
      const raw = String(card?.code || '').slice(1);
      if (raw === 'B') return 16;
      if (raw === 'R') return 17;
      const parsed = parseInt(raw, 10);
      return Number.isNaN(parsed) ? 0 : parsed;
    };
    const getRankOrder = (card: any) => rankPriority.get(getRank(card)) ?? 99;

    return [...hand].sort((a, b) => {
      const rankA = getRankOrder(a);
      const rankB = getRankOrder(b);
      if (rankA !== rankB) return rankA - rankB;
      const suitA = getSuit(a);
      const suitB = getSuit(b);
      const orderA = suitOrder[suitA] ?? 99;
      const orderB = suitOrder[suitB] ?? 99;
      return orderA - orderB;
    });
  };

  const autoArrangeHand = () => {
    if (!gameState?.myHand) return;
    const sorted = sortHandBySuitAndRank(gameState.myHand);
    const sortedCodes = sorted.map(card => card.code);
    setHandOrder(sortedCodes);
    setToast('手牌已自动排序');
  };

  const getSortedHand = () => {
    if (!gameState?.myHand) return [];
    if (handOrder.length === 0) return gameState.myHand;
    
    // 按handOrder排序手牌
    const handMap = new Map(gameState.myHand.map((card: any) => [card.code, card]));
    const sorted: any[] = [];
    
    for (const code of handOrder) {
      if (handMap.has(code)) {
        sorted.push(handMap.get(code));
        handMap.delete(code);
      }
    }
    
    // 添加handOrder中未包含的新牌（如果有）
    if (handMap.size > 0) {
      sorted.push(...Array.from(handMap.values()));
      // 只将新牌添加到handOrder末尾，保持现有顺序
      const newCards = Array.from(handMap.keys()) as string[];
      setHandOrder(prev => [...prev, ...newCards]);
    }
    
    return sorted;
  };

  const loadGameState = useCallback(async () => {
    const now = Date.now()
    if (now - lastFetchAtRef.current < 150) return
    if (isLoadingRef.current) return
    isLoadingRef.current = true
    lastFetchAtRef.current = now
    try {
      const res = await api.getGameState(roomId, playerId)
      if (res.success) {
        setGameState(res.data)
        // 同步手牌顺序
        const currentHand = Array.isArray(res.data?.myHand) ? res.data.myHand : []
        const currentHandCodes = currentHand.map((c: any) => c.code)
        
        // 使用函数式更新以确保使用最新的handOrder状态
        setHandOrder(prevOrder => {
          if (prevOrder.length === 0) {
            // 初始状态，使用默认顺序
            return currentHandCodes
          }
          // 智能更新手牌顺序：保留现有顺序，移除已出的牌，添加新牌到末尾
          const filteredOrder = prevOrder.filter(code => currentHandCodes.includes(code))
          const newCards = currentHandCodes.filter(code => !prevOrder.includes(code))
          const updatedOrder = [...filteredOrder, ...newCards]
          
          // 如果顺序有变化（长度不同或顺序不同），则更新
          if (updatedOrder.length !== prevOrder.length || 
              !updatedOrder.every((code, idx) => idx < prevOrder.length && prevOrder[idx] === code)) {
            return updatedOrder
          }
          // 顺序无变化，返回原顺序
          return prevOrder
        })
        
        if (res.data?.phase === 'TAKING_HOLE') {
          setHoleCards(Array.isArray(res.data?.holeCards) ? res.data.holeCards : [])
        } else {
          setHoleCards([])
        }
      }
    } catch {
    } finally {
      isLoadingRef.current = false
    }
  }, [playerId, roomId])

  const requestRefresh = useCallback(() => {
    if (refreshTimerRef.current !== null) return
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null
      loadGameState()
    }, 50)
  }, [loadGameState])

  useEffect(() => {
    loadGameState();
    
    const onGameUpdate = () => {
      requestRefresh()
    };
    const onRoomUpdate = () => {
      requestRefresh()
    };
    const onRoomClosed = () => {
      alert('房间已解散');
      navigate('/lan');
    };
    const onHoleRevealed = (data: any) => {
      setHoleCards(Array.isArray(data?.holeCards) ? data.holeCards : []);
    };
    const onHoleTaken = () => {
      setHoleCards([]);
      requestRefresh()
    };
    const onGameOver = (data: any) => {
      setSettlement({ winnerId: data?.winnerId, winnerSide: data?.winnerSide });
      setSettingMultiplier(null)
      requestRefresh()
    };
    const onMaxPlay = (data: any) => {
      const pid = data?.playerId;
      const name = pid === playerId ? myNameRef.current : '对手';
      setToast(`${name}出了最大牌，其他玩家自动跳过，由其继续出牌`);
      window.setTimeout(() => setToast(null), 1800);
      requestRefresh()
    };
    const onNextRoundReady = () => {
      requestRefresh()
    };
    const onUndo = (data: any) => {
      const pid = data?.playerId
      const name = pid === playerId ? myNameRef.current : '对手'
      setToast(`${name}撤销了上一次出牌`)
      window.setTimeout(() => setToast(null), 1600)
      requestRefresh()
    }
    const onBidMade = (data: any) => {
      const pid = data?.playerId
      const score = data?.score
      const forced = data?.forced
      const gs = gameStateRef.current
      const player = gs?.otherPlayers?.find((p: any) => p.id === pid)
      const name = pid === playerId ? myNameRef.current : (player?.name || '未知')
      
      let msg = ''
      if (score === 0) msg = '不叫'
      else msg = `叫了 ${score} 分`
      if (forced) msg += ' (强制)'
      
      setToast(`${name} ${msg}`)
      window.setTimeout(() => setToast(null), 2000)
      requestRefresh()
    }
    const onGameStarted = () => {
      setSettlement(null);
      setSettingMultiplier(null)
      setSelectedCards([]);
      setHoleCards([]);
      requestRefresh()
    }
    const onWsOpen = () => {
      requestRefresh()
    }

    socket.on('game_update', onGameUpdate);
    socket.on('game_started', onGameStarted);
    socket.on('game_over', onGameOver);
    socket.on('hole_revealed', onHoleRevealed);
    socket.on('hole_taken', onHoleTaken);
    socket.on('max_play', onMaxPlay);
    socket.on('next_round_ready', onNextRoundReady);
    socket.on('undo', onUndo);
    socket.on('bid_made', onBidMade);
    socket.on('room_update', onRoomUpdate);
    socket.on('final_settlement_initiated', (data: any) => {
      setFinalSettlement({
        initiatedBy: data.initiatedBy,
        confirmedPlayers: data.confirmedPlayers || []
      });
      setToast('房主已发起最终结算，请确认');
    });
    socket.on('final_settlement_confirmed', (data: any) => {
      setFinalSettlement((prev) => prev ? {
        ...prev,
        confirmedPlayers: data.confirmedPlayers || []
      } : null);
      if (data.playerId === playerId) {
        setToast('您已确认最终结算');
      }
    });

    socket.on('room_closed', onRoomClosed);
    socket.on('ws_open', onWsOpen);

    const pollId = window.setInterval(() => {
      setWsReadyState(socket.getReadyState());
      const now = Date.now()
      const lastMsg = socket.getLastMessageAt()
      if (!socket.isConnected()) requestRefresh()
      else if (lastMsg && now - lastMsg > 2000) requestRefresh()
    }, 800);

    return () => {
        window.clearInterval(pollId);
        if (refreshTimerRef.current !== null) {
          window.clearTimeout(refreshTimerRef.current)
          refreshTimerRef.current = null
        }
        socket.off('game_update', onGameUpdate);
        socket.off('game_started', onGameStarted);
        socket.off('game_over', onGameOver);
        socket.off('hole_revealed', onHoleRevealed);
        socket.off('hole_taken', onHoleTaken);
        socket.off('max_play', onMaxPlay);
        socket.off('next_round_ready', onNextRoundReady);
        socket.off('undo', onUndo);
        socket.off('bid_made', onBidMade);
        socket.off('room_update', onRoomUpdate);
        socket.off('room_closed', onRoomClosed);
        socket.off('ws_open', onWsOpen);
    };
  }, [loadGameState, navigate, playerId, requestRefresh, roomId]);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (!handContainerRef.current || !gameState?.myHand) return
    const count = gameState.myHand.length
    if (count <= 1) {
        setCardOverlap(0)
        return
    }
    const containerWidth = handContainerRef.current.clientWidth || window.innerWidth
    // cardSizeClass: w-[clamp(...)]
    // Estimate card width:
    // Narrow: 3.1rem ~ 50px to 4.2rem ~ 67px.
    // Desktop: w-20 ~ 80px.
    const cardBaseWidth = isNarrow ? (Math.min(window.innerWidth * 0.1, 67)) : 80
    // Actually we can read element width if rendered, but estimation is faster.
    // Let's be conservative.
    
    const available = containerWidth - 40 // Padding
    const totalRaw = count * cardBaseWidth
    
    if (totalRaw <= available) {
        setCardOverlap(10) // Positive gap
    } else {
        // Calculate needed negative margin
        // totalWidth = cardBaseWidth + (count - 1) * (cardBaseWidth + margin)
        // available = cardBaseWidth + (count - 1) * cardBaseWidth + (count - 1) * margin
        // available - count * cardBaseWidth = (count - 1) * margin
        const margin = (available - count * cardBaseWidth) / (count - 1)
        setCardOverlap(margin)
    }
  }, [viewportWidth, gameState?.myHand?.length, isNarrow])

  useEffect(() => {
    if (!gameState) return
    if (gameState.phase === 'FINISHED' && !settlement?.winnerId && gameState.winnerId) {
      setSettlement({ winnerId: gameState.winnerId, winnerSide: gameState.winnerSide })
      setSettingMultiplier(null)
    }
    if (gameState.phase !== 'FINISHED' && settlement?.winnerId) {
      setSettlement(null)
      setSettingMultiplier(null)
    }
  }, [gameState, settlement?.winnerId])

  useEffect(() => {
    if (!cannotBeatTable) return
    const p = gameState?.lastMove?.pattern
    const key = `${gameState?.roomId || ''}:${playerId}:${gameState?.currentTurn || ''}:${p?.type || ''}:${p?.rank || ''}:${p?.length || ''}`
    if (noBeatKey === key) return
    setNoBeatKey(key)
    setToast('当前无牌可压，请选择“不出”')
    window.setTimeout(() => setToast(null), 1800)
  }, [cannotBeatTable, gameState?.roomId, gameState?.currentTurn, gameState?.lastMove, noBeatKey, playerId])

  const toggleCard = (code: string) => {
    setSelectedCards(prev => 
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const handleBid = async (score: number) => {
      if (isActing) return;
      setIsActing(true);
      try {
        const res = await api.bid(roomId, playerId, score);
        if (!res.success) {
          alert(res.error);
        } else {
          await loadGameState();
        }
      } finally {
        setIsActing(false);
      }
  };

  const handleTakeHole = async () => {
    if (isActing) return;
    setIsActing(true);
    try {
      const res = await api.takeHole(roomId, playerId);
      if (!res.success) {
        alert(res.error);
      } else {
        setHoleCards([]);
        await loadGameState();
      }
    } finally {
      setIsActing(false);
    }
  };

  const handlePlay = async (cardsToPlay: string[] = selectedCards) => {
      if (cardsToPlay.length === 0) return alert('请选择要出的牌');
      if (cannotBeatTable) {
        setToast('当前无牌可压，请选择“不出”')
        window.setTimeout(() => setToast(null), 1800)
        return
      }
      
      // Optimistic UI update could go here, but we wait for server for now
      if (isActing) return;
      setIsActing(true);
      const res = await api.playCards(roomId, playerId, cardsToPlay);
      if (res.success) {
          setSelectedCards([]);
          await loadGameState();
      } else {
          alert(res.error);
      }
      setIsActing(false);
  };

  const handlePass = async () => {
      if (isActing) return;
      setIsActing(true);
      try {
        const res = await api.pass(roomId, playerId);
        if (!res.success) {
          alert(res.error);
        }
        setSelectedCards([]);
        await loadGameState();
      } finally {
        setIsActing(false);
      }
  };

  const handleCloseRoom = async () => {
      if (confirm('确定要解散房间吗？')) {
          await api.closeRoom(roomId, playerId);
          // Socket listener will handle redirect
      }
  };

  const handleDragEnd = (event: any, info: any, cardCode: string) => {
      // Check if dropped in play area (roughly upper half of screen or specific y threshold)
      // Since play area is above the hand, negative Y movement is key.
      // Let's use a threshold: if dragged up by more than 150px
      if (info.offset.y < -150) {
          if (cannotBeatTable) {
            setToast('当前无牌可压，请选择“不出”')
            window.setTimeout(() => setToast(null), 1800)
            return
          }
          // Determine what to play
          let cardsToPlay = [...selectedCards];
          if (!cardsToPlay.includes(cardCode)) {
              // If dragging a non-selected card, play just that one (or replace selection?)
              // Common behavior: If dragging unselected, assume it's a single card play
              // unless it's a valid combo? Let's just play that single card for simplicity
              // or add it to selection if multiselect is needed. 
              // Rule: If dragging unselected, it becomes the ONLY selection.
              cardsToPlay = [cardCode];
              setSelectedCards([cardCode]);
          }
      handlePlay(cardsToPlay);
  } else if (Math.abs(info.offset.x) > 50) {
      // 未触发出牌但水平移动足够大，调整手牌顺序
      const index = handOrder.indexOf(cardCode);
      if (index !== -1) {
        const newHandOrder = [...handOrder];
        // 根据拖拽方向移动牌：向右拖拽（正x）向右移动，向左拖拽（负x）向左移动
        if (info.offset.x > 0 && index < newHandOrder.length - 1) {
          // 向右移动：与右侧牌交换位置
          [newHandOrder[index], newHandOrder[index + 1]] = [newHandOrder[index + 1], newHandOrder[index]];
        } else if (info.offset.x < 0 && index > 0) {
          // 向左移动：与左侧牌交换位置
          [newHandOrder[index], newHandOrder[index - 1]] = [newHandOrder[index - 1], newHandOrder[index]];
        }
        setHandOrder(newHandOrder);
      }
  }
};

  if (!gameState) return (
      <div className="flex items-center justify-center h-screen bg-green-900 text-white">
          <div className="animate-pulse">正在加载牌桌...</div>
      </div>
  );

  const winnerName = settlement?.winnerId
    ? (settlement.winnerId === playerId
        ? myName
        : (gameState.otherPlayers.find((p: any) => p.id === settlement.winnerId)?.name || '玩家'))
    : '';
  const isDiggerWin = settlement?.winnerSide
    ? settlement.winnerSide === 'DIGGER'
    : (settlement?.winnerId ? settlement.winnerId === gameState.diggerId : false);
  const settlementHistory = Array.isArray((gameState as any)?.settlementHistory) ? (gameState as any).settlementHistory : []
  const settlementHeaders = settlementHistory.length > 0 && Array.isArray(settlementHistory[0]?.results) ? settlementHistory[0].results : []
  const settlementTotals = settlementHeaders.reduce((acc: any, r: any) => {
    acc[r.playerId] = 0
    return acc
  }, {} as any)
  settlementHistory.forEach((row: any) => {
    ;(row?.results || []).forEach((r: any) => {
      if (typeof r?.playerId !== 'string') return
      settlementTotals[r.playerId] = (settlementTotals[r.playerId] || 0) + (Number(r?.delta) || 0)
    })
  })

  const handleConfirmSettlement = async () => {
    try {
      await api.leaveRoom(roomId, playerId);
    } catch (e) {
    }
    navigate('/lan');
  };

  const handleInitiateFinalSettlement = async () => {
    if (isActing) return;
    setIsActing(true);
    try {
      const res = await api.initiateFinalSettlement(roomId, playerId);
      if (!res.success) alert(res.error);
      await loadGameState();
    } finally {
      setIsActing(false);
    }
  };

  const handleConfirmFinalSettlement = async () => {
    if (isActing) return;
    setIsActing(true);
    try {
      const res = await api.confirmFinalSettlement(roomId, playerId);
      if (!res.success) alert(res.error);
      await loadGameState();
    } finally {
      setIsActing(false);
    }
  };

  const handleNextRound = async () => {
    if (isActing) return;
    setIsActing(true);
    try {
      const res = await api.nextRound(roomId, playerId);
      if (!res.success) alert(res.error);
      await loadGameState();
    } finally {
      setIsActing(false);
    }
  };

  const handleUndo = async () => {
    if (isActing) return
    setIsActing(true)
    try {
      const res = await api.undo(roomId, playerId)
      if (!res.success) alert(res.error)
      setSelectedCards([])
      await loadGameState()
    } finally {
      setIsActing(false)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-[#1a472a] overflow-hidden relative select-none">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
      </div>

      {/* Top Info */}
      <div className="flex justify-between p-4 z-10 text-white/90 text-sm md:text-base shadow-sm bg-black/10 backdrop-blur-sm relative">
        <div className="flex items-center gap-4">
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
                        <span>{gameState.otherPlayers.find((p:any) => p.id === gameState.diggerId)?.name || (gameState.diggerId === playerId ? myName : '未知')}</span>
                    </div>
                )}
            </div>
        </div>

        {/* Persistent Hole Cards (Top Left) */}
        {gameState.initialHoleCards && gameState.initialHoleCards.length > 0 && ['PLAYING', 'SURRENDER'].includes(gameState.phase) && (
            <div className="absolute left-[180px] top-3 flex flex-col items-start opacity-90 pointer-events-none z-20">
                <div className="text-white/40 text-[10px] mb-0.5 ml-1">底牌</div>
                <div className="flex gap-0.5 scale-75 origin-top-left">
                    {gameState.initialHoleCards.map((c: any) => (
                        <Card key={c.code} code={c.code} />
                    ))}
                </div>
            </div>
        )}

        <div className="flex items-start gap-4">
            <VoicePanel
                voice={voice}
                players={gameState ? [
                    { id: playerId, name: myName },
                    ...gameState.otherPlayers.map((p:any) => ({ id: p.id, name: p.name }))
                ] : []}
                selfId={playerId}
            />
            <div className="text-right">
                <div className="text-[11px] text-white/70 mb-1">
                  WS: {wsReadyState === 1 ? '已连接' : '重连中'}
                </div>
                {gameState.hostId === playerId && (
                    <button 
                        type="button"
                        onClick={handleCloseRoom}
                        className="mb-1 text-xs bg-red-600/80 hover:bg-red-700 text-white px-2 py-1 rounded"
                    >
                        解散房间
                    </button>
                )}
                <div>底分: <span className="font-mono text-yellow-300">{gameState.bidScore}</span></div>
                <div className="font-bold flex items-center gap-2">
                    {gameState.currentTurn === playerId ? (
                        <span className="text-green-300 animate-pulse">👉 你的回合</span>
                    ) : (
                        <span className="text-gray-300">
                            等待 {gameState.otherPlayers.find((p:any) => p.id === gameState.currentTurn)?.name || (gameState.currentTurn === playerId ? myName : '他人')}...
                        </span>
                    )}
                </div>
            </div>
        </div>
      </div>

      {/* Surrender Phase UI (Centered on table, non-modal) */}
      {gameState.phase === 'SURRENDER' && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center pointer-events-none gap-8">
            
            {/* Show Hole Cards if Digger */}
            {gameState.diggerId === playerId && gameState.initialHoleCards && (
                <div className="flex justify-center gap-1 pointer-events-auto p-2 bg-black/40 rounded-xl backdrop-blur-sm">
                    <div className="text-white/80 text-xs mr-2 flex items-center">底牌</div>
                    {gameState.initialHoleCards.map((c: any) => (
                        <div key={c.code} className="transform scale-75 origin-center">
                            <Card code={c.code} />
                        </div>
                    ))}
                </div>
            )}
            
            {gameState.surrenderChoices?.[playerId] ? (
                <div className="flex flex-col items-center justify-center p-8 bg-black/40 rounded-3xl backdrop-blur-md border border-white/10 pointer-events-auto">
                    <div className="text-3xl mb-4 animate-bounce">⏳</div>
                    <div className="text-white text-lg font-bold mb-2">等待其他玩家选择...</div>
                    <div className={`text-sm px-4 py-1 rounded-full font-bold ${
                        gameState.surrenderChoices[playerId] === 'SURRENDER' 
                            ? 'bg-red-500/50 text-red-100' 
                            : 'bg-green-500/50 text-green-100'
                    }`}>
                        {gameState.surrenderChoices[playerId] === 'SURRENDER' ? '您已选择弃牌' : '您已选择继续'}
                    </div>
                </div>
            ) : (
                <div className="flex gap-12 pointer-events-auto">
                  <button
                    disabled={isActing}
                    onClick={async () => {
                      if (isActing) return
                      setIsActing(true)
                      try {
                        await api.surrender(roomId, playerId)
                      } catch (e) {
                        alert('操作失败')
                      } finally {
                        setIsActing(false)
                      }
                    }}
                    className="flex flex-col items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-red-700 hover:from-red-400 hover:to-red-600 text-white shadow-xl active:scale-95 transition-all border-2 border-white/20 group hover:scale-105 disabled:opacity-50 disabled:grayscale"
                  >
                    <span className="text-2xl mb-0.5 group-hover:scale-110 transition-transform">🏳️</span>
                    <span className="font-bold text-sm">弃牌</span>
                  </button>
                  
                  <button
                    disabled={isActing}
                    onClick={async () => {
                      if (isActing) return
                      setIsActing(true)
                      try {
                        await api.confirmContinue(roomId, playerId)
                        await loadGameState()
                      } catch (e) {
                        alert('操作失败')
                      } finally {
                        setIsActing(false)
                      }
                    }}
                    className="flex flex-col items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-green-700 hover:from-green-400 hover:to-green-600 text-white shadow-xl active:scale-95 transition-all border-2 border-white/20 group hover:scale-105 disabled:opacity-50 disabled:grayscale"
                  >
                    <span className="text-2xl mb-0.5 group-hover:scale-110 transition-transform">⚔️</span>
                    <span className="font-bold text-sm">继续</span>
                  </button>
                </div>
            )}

            <div className="text-white/80 text-sm font-bold bg-black/30 px-4 py-1 rounded-full backdrop-blur-sm">
              {gameState.diggerId === playerId ? '庄家抉择' : '闲家抉择'}
            </div>
        </div>
      )}

      {/* Opponents Area */}
      <div className="absolute inset-0 pointer-events-none z-10">
        {gameState.otherPlayers.map((p: any, i: number) => {
           const total = gameState.otherPlayers.length;
           let posClass = '';
           // Default for 4 players (3 opponents)
           if (total === 3) {
               if (i === 0) posClass = 'right-1 top-1/2 -translate-y-1/2 flex-col scale-90 origin-right'; // Right
               if (i === 1) posClass = 'top-14 left-1/2 -translate-x-1/2 flex-row scale-90 origin-top'; // Top
               if (i === 2) posClass = 'left-12 top-1/2 -translate-y-1/2 flex-col scale-90 origin-left'; // Left
           } else if (total === 2) {
               if (i === 0) posClass = 'right-1 top-1/2 -translate-y-1/2 flex-col scale-90 origin-right';
               if (i === 1) posClass = 'left-12 top-1/2 -translate-y-1/2 flex-col scale-90 origin-left';
           } else if (total === 1) {
               posClass = 'top-14 left-1/2 -translate-x-1/2 flex-row scale-90 origin-top';
           }
           
           return (
              <div key={p.id} className={`absolute ${posClass} pointer-events-auto flex items-center justify-center gap-2`}>
                  <div className={`
                      relative p-2 rounded-xl text-center transition-all duration-300 backdrop-blur-md
                      ${gameState.currentTurn === p.id 
                          ? 'bg-yellow-500/20 border-2 border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.3)]' 
                          : 'bg-black/40 border border-white/10'}
                  `}>
                     <div className="font-bold text-white text-xs md:text-sm whitespace-nowrap">
                         {p.id === gameState.diggerId && '👑 '}
                         {p.name}
                     </div>
                     <div className="flex justify-center items-center gap-1 mt-1">
                        <div className="bg-blue-600 w-4 h-5 md:w-5 md:h-7 rounded-sm border border-white/20"></div>
                        <span className="text-lg md:text-xl font-mono text-white">{p.cardCount}</span>
                     </div>
                  </div>
              </div>
           );
        })}
      </div>

      {/* Center Table / Last Move / Hole Cards */}
      <div ref={playAreaRef} className="flex-grow flex flex-col items-center justify-center relative z-0 pb-[320px] md:pb-[280px] px-12">
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
         
         {/* Drop Zone Indicator (Only visible when dragging could trigger play) */}
         <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
             <div className="w-full h-2/3 border-2 border-dashed border-white/10 rounded-3xl m-8"></div>
         </div>

         {/* Hole Cards Reveal */}
         <AnimatePresence>
         {holeCards.length > 0 && (
             <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute top-4 flex gap-1"
             >
                 {holeCards.map((c:any) => (
                     <div key={c.code} className="transform scale-75 origin-top">
                        <Card code={c.code} />
                     </div>
                 ))}
             </motion.div>
         )}
         </AnimatePresence>

         <div className="text-white/20 mb-4 font-bold tracking-widest uppercase">
            {gameState.lastMove ? 'Last Played' : 'Table'}
         </div>
         
         <AnimatePresence mode='wait'>
         {gameState.lastMove ? (
             <motion.div 
                key={gameState.lastMove.playerId + gameState.lastMove.cards.map((c:any) => c.code).join('')}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="flex flex-col items-center"
             >
                 <div className="text-sm mb-2 text-white/80 bg-black/30 px-3 py-1 rounded-full">
                    {gameState.lastMove.playerId === playerId ? myName : (gameState.otherPlayers.find((p:any) => p.id === gameState.lastMove.playerId)?.name || 'Player')}
                 </div>
                 <div className="flex flex-wrap justify-center gap-2">
                    {gameState.lastMove.cards.map((c:any, i:number) => (
                        <motion.div 
                            key={c.code} 
                            initial={{ x: 20 }}
                            animate={{ x: 0 }}
                        >
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

      {/* Player Hand */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-black/70 to-transparent pb-safe">
        <div className="px-4 pt-2 flex justify-end">
          <button
            onClick={autoArrangeHand}
            disabled={!gameState?.myHand || gameState.myHand.length === 0}
            className="mb-2 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium"
          >
            自动理牌
          </button>
        </div>
        {selectedCards.length > 0 && (
          <div className="px-4 pt-2">
            <div className="text-white/70 text-xs mb-2">已选牌</div>
            <div className={`w-full ${useTwoRows ? '' : 'overflow-x-auto'}`}>
              <div className={`${useTwoRows ? 'flex flex-wrap justify-center gap-2 pb-2' : 'flex gap-2 min-w-max pb-2 px-2 justify-center'}`}>
                {getSortedHand()
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

        {/* Hand Cards */}
        <div ref={handContainerRef} className={`w-full overflow-hidden pb-2 pt-2 px-4 ${useTwoRows ? 'min-h-[220px]' : 'min-h-[110px]'}`}>
          <AnimatePresence>
            {useTwoRows ? (
              <div className="flex flex-wrap justify-center items-end gap-2 h-full">
                {getSortedHand()
                  .filter((c: any) => !selectedCards.includes(c.code))
                  .map((card: any, idx: number) => (
                    <motion.div
                      key={card.code}
                      layoutId={card.code}
                      drag
                      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                      dragElastic={0.2}
                      dragSnapToOrigin={true}
                      onDragEnd={(e, info) => handleDragEnd(e, info, card.code)}
                      onClick={() => toggleCard(card.code)}
                      animate={{
                        y: 0,
                        zIndex: idx,
                      }}
                      whileHover={{ y: -10, zIndex: 100 }}
                      whileDrag={{ scale: 1.06, zIndex: 100, cursor: 'grabbing' }}
                      className="cursor-grab active:cursor-grabbing"
                    >
                      <Card code={card.code} selected={false} className={`shadow-2xl ${cardSizeClass}`} />
                    </motion.div>
                  ))}
              </div>
            ) : (
              <div className="flex justify-center items-end h-full" style={{ width: '100%' }}>
                {getSortedHand()
                  .filter((c: any) => !selectedCards.includes(c.code))
                  .map((card: any, idx: number) => (
                    <motion.div
                      key={card.code}
                      layoutId={card.code}
                      drag
                      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                      dragElastic={0.2}
                      dragSnapToOrigin={true}
                      onDragEnd={(e, info) => handleDragEnd(e, info, card.code)}
                      onClick={() => toggleCard(card.code)}
                      style={{ 
                          marginLeft: idx === 0 ? 0 : `${cardOverlap}px`,
                          zIndex: idx
                      }}
                      animate={{
                        y: 0,
                        zIndex: idx,
                      }}
                      whileHover={{ y: -20, zIndex: 100 }}
                      whileDrag={{ scale: 1.06, zIndex: 100, cursor: 'grabbing' }}
                      className="cursor-grab active:cursor-grabbing flex-shrink-0"
                    >
                      <Card code={card.code} selected={false} className={`shadow-2xl ${cardSizeClass}`} />
                    </motion.div>
                  ))}
              </div>
            )}
          </AnimatePresence>
        </div>
        
        {/* Actions Bar */}
        <div className="flex justify-center items-end pb-4">
           {gameState.currentTurn === playerId && (
               gameState.phase === 'BIDDING' ? (
                   <motion.div
                      initial={{y: 20, opacity: 0}}
                      animate={{y: 0, opacity: 1}}
                      className="mx-4 mb-4 flex flex-wrap justify-center gap-3 p-4 bg-black/60 rounded-3xl backdrop-blur-xl border border-white/20 shadow-2xl"
                   >
                     <div className="text-white font-bold text-lg flex items-center">请叫分:</div>
                     <button disabled={isActing} onClick={() => handleBid(1)} className="px-6 py-3 text-white rounded-full font-bold shadow-lg transition-transform active:scale-95 bg-blue-500 hover:bg-blue-600 border-2 border-blue-400 text-lg disabled:opacity-50">1分</button>
                     <button disabled={isActing} onClick={() => handleBid(2)} className="px-6 py-3 text-white rounded-full font-bold shadow-lg transition-transform active:scale-95 bg-blue-600 hover:bg-blue-700 border-2 border-blue-500 text-lg disabled:opacity-50">2分</button>
                     <button disabled={isActing} onClick={() => handleBid(3)} className="px-6 py-3 text-white rounded-full font-bold shadow-lg transition-transform active:scale-95 bg-blue-700 hover:bg-blue-800 border-2 border-blue-600 text-lg disabled:opacity-50">3分</button>
                     <button disabled={isActing} onClick={() => handleBid(4)} className="px-6 py-3 text-white rounded-full font-bold shadow-lg transition-transform active:scale-95 bg-purple-700 hover:bg-purple-800 border-2 border-purple-500 text-lg disabled:opacity-50">4分</button>
                     <button disabled={isActing} onClick={() => handleBid(0)} className="px-6 py-3 text-white rounded-full font-bold shadow-lg transition-transform active:scale-95 bg-slate-500 hover:bg-slate-600 border-2 border-slate-400 text-lg disabled:opacity-50">不叫</button>
                   </motion.div>
               ) : gameState.phase === 'PLAYING' ? (
                   <motion.div initial={{y: 20, opacity: 0}} animate={{y: 0, opacity: 1}} className="flex gap-4">
                     <button 
                      disabled={isActing || cannotBeatTable}
                       onClick={() => handlePlay()} 
                       className={`px-8 py-3 font-bold rounded-full shadow-lg active:scale-95 transition-all border ${cannotBeatTable ? 'bg-slate-500 text-white border-slate-400 cursor-not-allowed opacity-80' : 'bg-gradient-to-b from-yellow-400 to-yellow-600 text-yellow-950 border-yellow-300 hover:shadow-yellow-500/50'}`}
                     >
                        出牌
                     </button>
                     <button 
                       disabled={isActing}
                       onClick={handlePass} 
                        className="px-8 py-3 bg-slate-600 text-white font-bold rounded-full shadow-lg hover:bg-slate-500 active:scale-95 transition-all border border-slate-500"
                     >
                        不出
                     </button>
                   </motion.div>
               ) : null
           )}
        </div>

        {gameState.phase === 'PLAYING' &&
          !settlement?.winnerId &&
          gameState.lastMove?.playerId === playerId &&
          (gameState.passCount ?? 0) === 0 && (
            <div className="flex justify-center pb-4">
              <button
                disabled={isActing}
                onClick={handleUndo}
                className="px-8 py-3 bg-white/10 hover:bg-white/15 text-white font-bold rounded-full shadow-lg active:scale-95 transition-all border border-white/20"
              >
                撤销
              </button>
            </div>
          )}

      <AnimatePresence>
      {gameState.phase === 'TAKING_HOLE' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        >
          {gameState.diggerId === playerId ? (
            <div className="w-full max-w-lg mx-4 rounded-3xl bg-white/95 shadow-2xl p-6">
              <div className="text-xl font-extrabold text-slate-900 mb-3">请收底牌</div>
              <div className="text-slate-700 mb-4">底牌必须收下，收下后将加入你的手牌。</div>
              <div className="flex justify-center gap-2 mb-6">
                {(holeCards.length > 0 ? holeCards : (gameState.holeCards || [])).map((c:any) => (
                  <div key={c.code} className="transform scale-90">
                    <Card code={c.code} />
                  </div>
                ))}
              </div>
              <button
                disabled={isActing}
                onClick={handleTakeHole}
                className="w-full rounded-2xl bg-purple-700 hover:bg-purple-800 text-white font-extrabold py-4 text-xl disabled:opacity-50"
              >
                收底牌
              </button>
            </div>
          ) : (
            <div className="w-full max-w-lg mx-4 rounded-3xl bg-white/95 shadow-2xl p-6 text-center">
              <div className="text-xl font-extrabold text-slate-900 mb-2">等待坑主收底牌…</div>
              <div className="text-slate-700 mb-4">底牌收下后将自动进入出牌阶段。</div>
              <div className="flex justify-center -space-x-8 overflow-visible">
                {(holeCards.length > 0 ? holeCards : (gameState.holeCards || [])).map((c:any, i:number) => (
                  <div key={c.code} className="transform scale-90" style={{ zIndex: i }}>
                    <Card code={c.code} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}
      </AnimatePresence>
      </div>

      <AnimatePresence>
      {settlement?.winnerId &&
        (gameState as any)?.settlementMultiplierPending &&
        ((gameState as any)?.hostId === playerId ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          >
            <div className="w-full max-w-md mx-4 rounded-3xl bg-white/95 shadow-2xl p-6">
              <div className="text-2xl font-extrabold text-slate-900 mb-2">选择本局翻倍</div>
              <div className="text-slate-700 mb-6">仅房主可选择，选择后所有玩家同步进入结算。</div>
              <div className="grid grid-cols-4 gap-3">
                {[1, 2, 4, 8].map(m => (
                  <button
                    key={m}
                    type="button"
                    disabled={isActing || settingMultiplier !== null}
                    onClick={async () => {
                      if (settingMultiplier !== null) return
                      setSettingMultiplier(m)
                      setIsActing(true)
                      try {
                        const res = await api.setSettlementMultiplier(roomId, playerId, m)
                        if (!res?.success) alert(res?.error || '设置翻倍失败')
                        await loadGameState()
                      } finally {
                        setIsActing(false)
                      }
                    }}
                    className="w-full rounded-2xl bg-slate-900 hover:bg-slate-950 disabled:opacity-50 text-white font-extrabold py-3 text-lg"
                  >
                    x{m}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          >
            <div className="w-full max-w-md mx-4 rounded-3xl bg-white/95 shadow-2xl p-6 text-center">
              <div className="text-2xl font-extrabold text-slate-900 mb-2">等待房主选择翻倍…</div>
              <div className="text-slate-700">选择完成后将自动进入结算。</div>
            </div>
          </motion.div>
        ))}
      {settlement?.winnerId && !(gameState as any)?.settlementMultiplierPending && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
        >
          <div className="w-full max-w-md mx-4 rounded-3xl bg-white/95 shadow-2xl p-6">
            <div className="text-2xl font-extrabold text-slate-900 mb-3">本局结束</div>
            {typeof (gameState as any)?.settlementMultiplier === 'number' && (
              <div className="text-slate-700 mb-2">
                翻倍：<span className="font-bold text-slate-900">x{(gameState as any).settlementMultiplier}</span>
              </div>
            )}
            <div className="text-slate-700 mb-2">
              胜者：<span className="font-bold text-slate-900">{winnerName}</span>
            </div>
            <div className={`mb-6 font-bold ${isDiggerWin ? 'text-purple-700' : 'text-green-700'}`}>
              胜方：{isDiggerWin ? '坑主方' : '对抗方'}
            </div>
            {settlementHistory.length > 0 && settlementHeaders.length > 0 && (
              <div className="mb-5">
                <div className="text-sm font-bold text-slate-800 mb-2">记分表</div>
                <div className="overflow-auto max-h-[40vh] rounded-2xl border border-slate-200 bg-white">
                  <table className="w-full text-[11px]">
                    <thead className="sticky top-0 bg-white">
                      <tr className="text-slate-600">
                        <th className="text-left px-2 py-2 border-b border-slate-200">局</th>
                        {settlementHeaders.map((p: any) => (
                          <th key={p.playerId} className="text-right px-2 py-2 border-b border-slate-200 whitespace-nowrap">
                            {p.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {settlementHistory.map((row: any) => (
                        <tr key={String(row.round)} className="text-slate-800">
                          <td className="px-2 py-2 border-b border-slate-100 whitespace-nowrap">
                            第{row.round}局
                          </td>
                          {settlementHeaders.map((h: any) => {
                            const r = (row?.results || []).find((x: any) => x?.playerId === h.playerId)
                            const delta = Number(r?.delta) || 0
                            const isWinnerCell = !!r?.isWinner
                            return (
                              <td
                                key={h.playerId}
                                className={[
                                  'px-2 py-2 border-b border-slate-100 text-right font-mono whitespace-nowrap',
                                  delta > 0 ? 'text-green-700' : delta < 0 ? 'text-red-700' : 'text-slate-700',
                                ].join(' ')}
                              >
                                {delta > 0 ? `+${delta}` : String(delta)}
                                {isWinnerCell ? <span className="ml-1 font-bold text-slate-700">胜</span> : <span className="ml-1 text-slate-400">负</span>}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                      <tr className="font-bold">
                        <td className="px-2 py-2">合计</td>
                        {settlementHeaders.map((h: any) => {
                          const total = Number(settlementTotals[h.playerId]) || 0
                          return (
                            <td
                              key={h.playerId}
                              className={[
                                'px-2 py-2 text-right font-mono whitespace-nowrap',
                                total > 0 ? 'text-green-700' : total < 0 ? 'text-red-700' : 'text-slate-700',
                              ].join(' ')}
                            >
                              {total > 0 ? `+${total}` : String(total)}
                            </td>
                          )
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <button
                disabled={isActing || (Array.isArray(gameState?.nextRoundReady) && gameState.nextRoundReady.includes(playerId))}
                onClick={handleNextRound}
                className="w-full rounded-2xl bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-3 text-lg"
              >
                {Array.isArray(gameState?.nextRoundReady) && gameState.nextRoundReady.includes(playerId) ? '已准备' : '继续游戏'}
              </button>
              <button
                disabled={isActing}
                onClick={handleConfirmSettlement}
                className="w-full rounded-2xl bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-bold py-3 text-lg"
              >
                离开房间
              </button>
            </div>
            {gameState?.hostId === playerId && 
             typeof gameState?.playerCount === 'number' && 
             typeof gameState?.maxPlayers === 'number' &&
             gameState.playerCount < gameState.maxPlayers && (
              <button
                disabled={isActing}
                onClick={handleInitiateFinalSettlement}
                className="w-full mt-3 rounded-2xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-3 text-lg"
              >
                最终结算
              </button>
            )}
            <div className="text-sm text-slate-600 mt-3">
              准备人数：{Array.isArray(gameState?.nextRoundReady) ? gameState.nextRoundReady.length : 0}/{gameState?.maxPlayers || ((gameState?.otherPlayers?.length || 0) + 1)}
            </div>
            {finalSettlement && (
              <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-2xl">
                <div className="font-bold text-purple-800 mb-2">最终结算确认</div>
                <div className="text-sm text-purple-700 mb-2">
                  发起者：{finalSettlement.initiatedBy === playerId ? '您' : '房主'}
                </div>
                <div className="text-sm text-purple-700 mb-3">
                  已确认：{finalSettlement.confirmedPlayers.length}/{gameState?.maxPlayers || ((gameState?.otherPlayers?.length || 0) + 1)}
                </div>
                {!finalSettlement.confirmedPlayers.includes(playerId) ? (
                  <button
                    disabled={isActing}
                    onClick={handleConfirmFinalSettlement}
                    className="w-full rounded-2xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-3"
                  >
                    确认最终结算
                  </button>
                ) : (
                  <div className="text-center text-purple-600 font-bold py-3">
                    您已确认最终结算
                  </div>
                )}
              </div>
            )}
            {typeof gameState?.playerCount === 'number' &&
              typeof gameState?.maxPlayers === 'number' &&
              gameState.playerCount < gameState.maxPlayers && (
                <div className="text-xs text-slate-500 mt-1">
                  等待玩家补齐：{gameState.playerCount}/{gameState.maxPlayers}
                </div>
              )}
          </div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}
