import React, { useEffect, useState, useRef } from 'react';
import { api } from '../services/api';
import Card from './Card';
import { socket } from '../services/socket';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

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
  const navigate = useNavigate();
  const playAreaRef = useRef<HTMLDivElement>(null);
  const myName = localStorage.getItem('playerName') || '我';
  const isLoadingRef = useRef(false);

  useEffect(() => {
    socket.joinRoom(roomId);
    loadGameState();
    
    const onGameUpdate = () => {
      loadGameState();
    };
    const onRoomClosed = () => {
      alert('房间已解散');
      navigate('/');
    };
    const onHoleRevealed = (data: any) => {
      setHoleCards(Array.isArray(data?.holeCards) ? data.holeCards : []);
    };
    const onHoleTaken = () => {
      setHoleCards([]);
      loadGameState();
    };
    const onGameOver = (data: any) => {
      setSettlement({ winnerId: data?.winnerId, winnerSide: data?.winnerSide });
      loadGameState();
    };

    socket.on('game_update', onGameUpdate);
    socket.on('game_started', onGameUpdate);
    socket.on('game_over', onGameOver);
    socket.on('hole_revealed', onHoleRevealed);
    socket.on('hole_taken', onHoleTaken);

    socket.on('room_closed', onRoomClosed);

    const pollId = window.setInterval(() => {
      setWsReadyState(socket.getReadyState());
      if (!socket.isConnected()) {
        loadGameState();
      }
    }, 1500);

    return () => {
        window.clearInterval(pollId);
        socket.off('game_update', onGameUpdate);
        socket.off('game_started', onGameUpdate);
        socket.off('game_over', onGameOver);
        socket.off('hole_revealed', onHoleRevealed);
        socket.off('hole_taken', onHoleTaken);
        socket.off('room_closed', onRoomClosed);
        socket.leaveRoom(roomId);
    };
  }, [roomId, playerId, navigate]);

  const loadGameState = async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    const res = await api.getGameState(roomId, playerId);
    if (res.success) {
      setGameState(res.data);
      if (res.data?.phase === 'TAKING_HOLE') {
        setHoleCards(Array.isArray(res.data?.holeCards) ? res.data.holeCards : []);
      } else {
        setHoleCards([]);
      }
    }
    isLoadingRef.current = false;
  };

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

  const handleConfirmSettlement = async () => {
    try {
      await api.leaveRoom(roomId, playerId);
    } catch (e) {
    }
    navigate('/');
  };

  return (
    <div className="flex flex-col h-screen bg-[#1a472a] overflow-hidden relative select-none">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
      </div>

      {/* Top Info */}
      <div className="flex justify-between p-4 z-10 text-white/90 text-sm md:text-base shadow-sm bg-black/10 backdrop-blur-sm">
        <div>
            <div className="font-bold text-lg text-yellow-100 drop-shadow-md">
                阶段：<span className="text-white">{gameState.phase === 'BIDDING' ? '叫分' : (gameState.phase === 'TAKING_HOLE' ? '收底牌' : '出牌')}</span>
            </div>
            {gameState.diggerId && (
                <div className="flex items-center gap-1 text-yellow-400">
                    <span>👑 坑主:</span>
                    <span>{gameState.otherPlayers.find((p:any) => p.id === gameState.diggerId)?.name || (gameState.diggerId === playerId ? myName : '未知')}</span>
                </div>
            )}
        </div>
        <div className="text-right">
            <div className="text-[11px] text-white/70 mb-1">
              WS: {wsReadyState === 1 ? '已连接' : '重连中'}
            </div>
            {gameState.hostId === playerId && (
                <button 
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
                        等待 {gameState.otherPlayers.find((p:any) => p.id === gameState.currentTurn)?.name || '他人'}...
                    </span>
                )}
            </div>
        </div>
      </div>

      {/* Opponents Area */}
      <div className="flex justify-around py-4 z-10">
        {gameState.otherPlayers.map((p: any) => (
          <div key={p.id} className={`
              relative p-3 rounded-xl min-w-[80px] text-center transition-all duration-300
              ${gameState.currentTurn === p.id 
                  ? 'bg-yellow-500/20 border-2 border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.3)]' 
                  : 'bg-black/20 border border-white/10'}
          `}>
             <div className="font-bold text-white text-sm">
                 {p.id === gameState.diggerId && '👑 '}
                 {p.name}
             </div>
             <div className="flex justify-center items-center gap-1 mt-1">
                <div className="bg-blue-600 w-5 h-7 rounded-sm border border-white/20"></div>
                <span className="text-xl font-mono text-white">{p.cardCount}</span>
             </div>
          </div>
        ))}
      </div>

      {/* Center Table / Last Move / Hole Cards */}
      <div ref={playAreaRef} className="flex-grow flex flex-col items-center justify-center relative z-0 pb-[320px] md:pb-[280px]">
         
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
                 <div className="flex -space-x-8">
                    {gameState.lastMove.cards.map((c:any, i:number) => (
                        <motion.div 
                            key={c.code} 
                            style={{ zIndex: i }}
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
        {selectedCards.length > 0 && (
          <div className="px-4 pt-2">
            <div className="text-white/70 text-xs mb-2">已选牌</div>
            <div className="flex justify-center">
              <div className="flex -space-x-8 overflow-visible max-w-full pb-2">
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
                      style={{ zIndex: 2000 }}
                    >
                      <div className="transform scale-75 origin-bottom">
                        <Card code={card.code} className="shadow-2xl" />
                      </div>
                    </motion.div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Hand Cards */}
        <div className="flex justify-center -space-x-[3.2rem] overflow-visible pb-2 pt-2 px-4 min-h-[110px]">
          <AnimatePresence>
          {gameState.myHand
            .filter((c: any) => !selectedCards.includes(c.code))
            .map((card: any, idx: number, arr: any[]) => {
            return (
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
                        zIndex: 1000 + idx,
                        rotate: (idx - arr.length / 2) * 2 // Fan effect
                    }}
                    whileHover={{ y: -10, zIndex: 3000 }}
                    whileDrag={{ scale: 1.1, zIndex: 3000, cursor: 'grabbing' }}
                    className="cursor-grab active:cursor-grabbing origin-bottom"
                >
                   <Card 
                     code={card.code} 
                     selected={false} // Managed by motion.div animate prop
                     className="shadow-2xl"
                   />
                </motion.div>
            );
          })}
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
                     <button disabled={isActing} onClick={() => handleBid(1)} className="btn-action bg-blue-500 hover:bg-blue-600 border-2 border-blue-400 text-lg px-6 py-3 disabled:opacity-50">1分</button>
                     <button disabled={isActing} onClick={() => handleBid(2)} className="btn-action bg-blue-600 hover:bg-blue-700 border-2 border-blue-500 text-lg px-6 py-3 disabled:opacity-50">2分</button>
                     <button disabled={isActing} onClick={() => handleBid(3)} className="btn-action bg-blue-700 hover:bg-blue-800 border-2 border-blue-600 text-lg px-6 py-3 disabled:opacity-50">3分</button>
                     <button disabled={isActing} onClick={() => handleBid(4)} className="btn-action bg-purple-700 hover:bg-purple-800 border-2 border-purple-500 text-lg px-6 py-3 disabled:opacity-50">4分</button>
                     <button disabled={isActing} onClick={() => handleBid(0)} className="btn-action bg-slate-500 hover:bg-slate-600 border-2 border-slate-400 text-lg px-6 py-3 disabled:opacity-50">不叫</button>
                   </motion.div>
               ) : gameState.phase === 'PLAYING' ? (
                   <motion.div initial={{y: 20, opacity: 0}} animate={{y: 0, opacity: 1}} className="flex gap-4">
                     <button 
                       disabled={isActing}
                       onClick={() => handlePlay()} 
                        className="px-8 py-3 bg-gradient-to-b from-yellow-400 to-yellow-600 text-yellow-950 font-bold rounded-full shadow-lg hover:shadow-yellow-500/50 active:scale-95 transition-all border border-yellow-300"
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

      <style>{`
        .btn-action {
            @apply px-6 py-2 text-white rounded-full font-bold shadow-lg transition-transform active:scale-95;
        }
        .pb-safe {
            padding-bottom: env(safe-area-inset-bottom, 20px);
        }
      `}</style>

      <AnimatePresence>
      {settlement?.winnerId && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
        >
          <div className="w-full max-w-md mx-4 rounded-3xl bg-white/95 shadow-2xl p-6">
            <div className="text-2xl font-extrabold text-slate-900 mb-3">本局结束</div>
            <div className="text-slate-700 mb-2">
              胜者：<span className="font-bold text-slate-900">{winnerName}</span>
            </div>
            <div className={`mb-6 font-bold ${isDiggerWin ? 'text-purple-700' : 'text-green-700'}`}>
              胜方：{isDiggerWin ? '坑主方' : '对抗方'}
            </div>
            <button
              onClick={handleConfirmSettlement}
              className="w-full rounded-2xl bg-green-600 hover:bg-green-700 text-white font-bold py-3 text-lg"
            >
              返回大厅
            </button>
          </div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}
