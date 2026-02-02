import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import Card from './Card';
import { socket } from '../services/socket';

interface GameTableProps {
  roomId: string;
  playerId: string;
}

export default function GameTable({ roomId, playerId }: GameTableProps) {
  const [gameState, setGameState] = useState<any>(null);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);

  useEffect(() => {
    loadGameState();
    
    socket.on('game_update', () => {
        loadGameState();
    });

    return () => {
        socket.off('game_update');
    };
  }, [roomId, playerId]);

  const loadGameState = async () => {
    const res = await api.getGameState(roomId, playerId);
    if (res.success) {
      setGameState(res.data);
    }
  };

  const toggleCard = (code: string) => {
    setSelectedCards(prev => 
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  if (!gameState) return <div className="p-4 text-white">Loading game table...</div>;

  return (
    <div className="flex flex-col h-screen bg-green-800 p-4 text-white">
      {/* Top Info */}
      <div className="flex justify-between mb-4">
        <div>Phase: {gameState.phase}</div>
        <div>Turn: {gameState.currentTurn === playerId ? 'YOUR TURN' : 'Waiting...'}</div>
      </div>

      {/* Opponents Area (Simplified) */}
      <div className="flex justify-around mb-8">
        {gameState.otherPlayers.map((p: any) => (
          <div key={p.id} className="bg-green-700 p-2 rounded text-center">
             <div>Player {p.id.slice(0, 4)}</div>
             <div className="text-yellow-300">{p.cardCount} cards</div>
          </div>
        ))}
      </div>

      {/* Center Table / Last Move */}
      <div className="flex-grow flex items-center justify-center bg-green-900 bg-opacity-30 rounded-lg mb-4 relative">
         <div className="text-white opacity-50">Table Area</div>
         {gameState.lastMove && (
             <div className="absolute flex gap-2">
                 {/* Render last played cards */}
             </div>
         )}
      </div>

      {/* Player Hand */}
      <div className="mt-auto">
        <div className="flex justify-center -space-x-8 overflow-x-auto pb-4 pt-8 min-h-[120px]">
          {gameState.myHand.map((card: any, idx: number) => (
            <div key={idx} className="relative transition-transform hover:z-10 hover:-translate-y-2">
               <Card 
                 code={card.code} 
                 selected={selectedCards.includes(card.code)}
                 onClick={() => toggleCard(card.code)}
               />
            </div>
          ))}
        </div>
        
        {/* Actions */}
        <div className="flex justify-center gap-4 mt-4 pb-4">
           {gameState.currentTurn === playerId && (
               <>
                 <button className="bg-yellow-500 text-black px-6 py-2 rounded shadow hover:bg-yellow-400 font-bold">Play</button>
                 <button className="bg-gray-500 text-white px-6 py-2 rounded shadow hover:bg-gray-400">Pass</button>
               </>
           )}
        </div>
      </div>
    </div>
  );
}
