export enum Suit {
  HEARTS = 'H',
  DIAMONDS = 'D',
  CLUBS = 'C',
  SPADES = 'S',
  JOKER = 'J'
}

export interface Card {
  suit: Suit;
  rank: number; // 3=3 ... 10=10, 11=J, 12=Q, 13=K, 14=A, 15=2, 16=Black Joker, 17=Red Joker
  code: string; // Unique identifier for frontend
}

export type CardType = 
    | 'SINGLE' 
    | 'PAIR' 
    | 'TRIPLET' 
    | 'QUAD'
    | 'STRAIGHT' 
    | 'CONSECUTIVE_PAIRS'
    | 'CONSECUTIVE_TRIPLETS';

export interface HandPattern {
    type: CardType;
    rank: number;
    length: number;
}

export interface PlayedMove {
  cards: Card[];
  pattern: HandPattern;
}

export interface GameState {
  roomId: string;
  deck: Card[]; // Remaining cards (for digging)
  playersHand: { [playerId: string]: Card[] };
  playedCardsByPlayer: { [playerId: string]: Card[] };
  playedMovesByPlayer: { [playerId: string]: PlayedMove[] };
  currentTurn: string; // playerId
  phase: 'BIDDING' | 'TAKING_HOLE' | 'SURRENDER' | 'PLAYING' | 'FINISHED';
  bidScore: number;
  diggerId: string | null;
  biddingStarterId: string;
  passCount: number;
  lastMove: {
    playerId: string;
    cards: Card[];
    pattern: HandPattern;
  } | null;
  initialHoleCards?: Card[];
}
