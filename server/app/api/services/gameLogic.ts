import { Card, HandPattern } from '../models/gameTypes';

export const getCardRank = (card: Card): number => getCompareValue(card.rank);

export const sortCards = (cards: Card[]): Card[] => {
    return [...cards].sort((a, b) => getCompareValue(b.rank) - getCompareValue(a.rank));
};

// Analyze the pattern of selected cards
export const analyzeHand = (cards: Card[]): HandPattern | null => {
    if (cards.length === 0) return null;

    const sorted = [...cards].sort((a, b) => a.rank - b.rank); // Ascending for analysis
    const len = sorted.length;
    const ranks = sorted.map(c => c.rank);

    if (len === 4 && ranks[0] === ranks[3]) {
        return { type: 'QUAD', rank: ranks[0], length: 4 };
    }

    // Check Single
    if (len === 1) {
        return { type: 'SINGLE', rank: ranks[0], length: 1 };
    }

    // Check Pair
    if (len === 2 && ranks[0] === ranks[1]) {
        return { type: 'PAIR', rank: ranks[0], length: 2 };
    }

    // Check Triplet
    if (len === 3 && ranks[0] === ranks[2]) {
        return { type: 'TRIPLET', rank: ranks[0], length: 3 };
    }

    // Straight (Min 3 cards)
    if (len >= 3 && isStraight(ranks)) {
        return { type: 'STRAIGHT', rank: ranks[len - 1], length: len };
    }

    // Check Consecutive Pairs (Min 3 pairs = 6 cards)
    if (len >= 6 && len % 2 === 0 && isConsecutivePairs(ranks)) {
        return { type: 'CONSECUTIVE_PAIRS', rank: ranks[len - 1], length: len / 2 };
    }

    if (len >= 6 && len % 3 === 0 && isConsecutiveTriplets(ranks)) {
        return { type: 'CONSECUTIVE_TRIPLETS', rank: ranks[len - 1], length: len / 3 };
    }

    return null;
};

const isStraight = (ranks: number[]): boolean => {
    if (ranks[0] < 4) return false;
    if (ranks[ranks.length - 1] > 13) return false;

    for (let i = 0; i < ranks.length - 1; i++) {
        if (ranks[i + 1] !== ranks[i] + 1) return false;
    }
    return true;
};

const isConsecutivePairs = (ranks: number[]): boolean => {
    if (ranks[0] < 4) return false;
    if (ranks[ranks.length - 1] > 13) return false;

    for (let i = 0; i < ranks.length; i += 2) {
        if (ranks[i] !== ranks[i+1]) return false; // Not a pair
        if (i > 0 && ranks[i] !== ranks[i-2] + 1) return false; // Not consecutive
    }
    return true;
};

const isConsecutiveTriplets = (ranks: number[]): boolean => {
    if (ranks[0] < 4) return false;
    if (ranks[ranks.length - 1] > 13) return false;
    for (let i = 0; i < ranks.length; i += 3) {
        if (!(ranks[i] === ranks[i + 1] && ranks[i + 1] === ranks[i + 2])) return false;
        if (i > 0 && ranks[i] !== ranks[i - 3] + 1) return false;
    }
    return true;
};

// Check if current hand beats the last hand
export const canBeat = (current: Card[], last: Card[]): boolean => {
    const currPattern = analyzeHand(current);
    const lastPattern = analyzeHand(last);

    if (!currPattern || !lastPattern) return false;

    // Otherwise types must match
    if (currPattern.type !== lastPattern.type) return false;

    // Length must match (for straights/pairs)
    if (currPattern.length !== lastPattern.length) return false;

    // Compare rank
    return getCompareValue(currPattern.rank) > getCompareValue(lastPattern.rank);
};

export const getCompareValue = (rank: number): number => {
    if (rank === 3) return 13;
    if (rank === 15) return 12;
    if (rank === 14) return 11;
    return rank - 4;
};
