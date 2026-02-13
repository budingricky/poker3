import React from 'react';

interface CardProps {
  code: string;
  onClick?: () => void;
  selected?: boolean;
  className?: string;
}

// Standard SVG Paths for Suits (ViewBox 0 0 24 24)
const SUIT_PATHS = {
  S: "M12,2C7,2,3,6,3,11c0,3,2,6,5,8l0,0c0,2-2,3-2,3h12c0,0-2-1-2-3l0,0c3-2,5-5,5-8C21,6,17,2,12,2z", // Spade (Simplified)
  H: "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z", // Heart
  D: "M12 2L2 12l10 10 10-10L12 2z", // Diamond
  C: "M19.5,9.5c-1.2,0-2.2,0.6-2.9,1.5c-0.6-1.8-2.4-3-4.6-3c-2.2,0-4,1.2-4.6,3c-0.7-0.9-1.7-1.5-2.9-1.5c-2.1,0-3.8,1.8-3.8,4c0,2.1,1.7,3.8,3.6,4c0.1,0.5,0.2,1,0.2,1.5l-2,3.5h13l-2-3.5c0-0.5,0.1-1,0.2-1.5c1.9-0.2,3.6-1.9,3.6-4C23.3,11.3,21.6,9.5,19.5,9.5z", // Club
  J: "M12,2 L15,8 L22,9 L17,14 L18,21 L12,18 L6,21 L7,14 L2,9 L9,8 z" // Star for Joker
};

export default function Card({ code, onClick, selected, className = '' }: CardProps) {
  const suit = code[0] as 'H' | 'D' | 'C' | 'S' | 'J';
  const rank = code.slice(1);
  
  // Color Logic
  const isRed = suit === 'H' || suit === 'D' || (suit === 'J' && rank === 'R');
  const colorClass = isRed ? 'text-red-600 fill-current' : 'text-slate-900 fill-current';
  
  // Rank Display Logic
  const getDisplayRank = (r: string) => {
      if (r === 'B') return '小王';
      if (r === 'R') return '大王';
      if (r === '11') return 'J';
      if (r === '12') return 'Q';
      if (r === '13') return 'K';
      if (r === '14') return 'A';
      if (r === '15') return '2';
      return r;
  };

  const displayRank = getDisplayRank(rank);
  const isJoker = suit === 'J';
  const isFace = ['J', 'Q', 'K', 'A', '2'].includes(displayRank);

  return (
    <div
      onClick={onClick}
      className={`
        relative w-20 h-28 bg-white border border-gray-300 rounded-lg shadow-md 
        flex flex-col items-center justify-center cursor-pointer select-none overflow-hidden transition-transform duration-200
        ${selected ? 'transform -translate-y-4 ring-2 ring-blue-400 shadow-xl' : 'hover:-translate-y-1 hover:shadow-lg'}
        ${className}
      `}
    >
      {/* --- Top Left Corner --- */}
      <div className={`absolute top-1 left-1 flex flex-col items-center leading-none ${colorClass}`}>
        <div className="text-sm font-bold tracking-tighter">{isJoker ? displayRank : displayRank}</div>
        {!isJoker && (
          <svg viewBox="0 0 24 24" className="w-3 h-3">
            <path d={SUIT_PATHS[suit]} />
          </svg>
        )}
      </div>

      {/* --- Center Content --- */}
      <div className={`flex items-center justify-center w-full h-full ${colorClass}`}>
        {isJoker ? (
           <div className="flex flex-col items-center">
             <svg viewBox="0 0 24 24" className="w-12 h-12">
               <path d={SUIT_PATHS['J']} />
             </svg>
             <span className="text-xs font-extrabold mt-1 text-center tracking-widest">{displayRank}</span>
           </div>
        ) : isFace ? (
            // Face Cards & Ace: Large Letter
            <div className="text-4xl font-serif font-bold opacity-90">{displayRank}</div>
        ) : (
            // Number Cards: Large Suit
            <svg viewBox="0 0 24 24" className="w-10 h-10 opacity-80">
                <path d={SUIT_PATHS[suit]} />
            </svg>
        )}
      </div>

      {/* --- Bottom Right Corner (Rotated) --- */}
      <div className={`absolute bottom-1 right-1 flex flex-col items-center leading-none transform rotate-180 ${colorClass}`}>
        <div className="text-sm font-bold tracking-tighter">{isJoker ? displayRank : displayRank}</div>
        {!isJoker && (
          <svg viewBox="0 0 24 24" className="w-3 h-3">
            <path d={SUIT_PATHS[suit]} />
          </svg>
        )}
      </div>
    </div>
  );
}
