import React from 'react';

interface CardProps {
  code: string;
  onClick?: () => void;
  selected?: boolean;
}

export default function Card({ code, onClick, selected }: CardProps) {
  const suit = code[0];
  const rank = code.slice(1);
  
  const getSuitSymbol = (s: string) => {
    switch (s) {
      case 'H': return '♥';
      case 'D': return '♦';
      case 'C': return '♣';
      case 'S': return '♠';
      case 'J': return '★'; // Joker
      default: return '';
    }
  };

  const getColor = (s: string) => {
    return (s === 'H' || s === 'D' || (s === 'J' && rank === 'R')) ? 'text-red-600' : 'text-black';
  };
  
  const getDisplayRank = (r: string) => {
      if (r === 'B') return 'Joker';
      if (r === 'R') return 'Joker';
      if (r === '11') return 'J';
      if (r === '12') return 'Q';
      if (r === '13') return 'K';
      if (r === '14') return 'A';
      if (r === '15') return '2';
      return r;
  }

  return (
    <div
      onClick={onClick}
      className={`
        w-16 h-24 bg-white border rounded shadow flex flex-col items-center justify-center cursor-pointer select-none
        ${selected ? 'transform -translate-y-4 border-blue-500 ring-2 ring-blue-300' : 'border-gray-300'}
        ${getColor(suit)}
      `}
    >
      <div className="text-lg font-bold">{getDisplayRank(rank)}</div>
      <div className="text-2xl">{getSuitSymbol(suit)}</div>
    </div>
  );
}
