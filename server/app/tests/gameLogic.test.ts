import { gameService } from '../api/services/gameService';
import { roomService } from '../api/services/roomService';

console.log('Running Game Logic Tests...');

// 1. Create Room
const room = roomService.createRoom('Host', 'Test Room');
console.log('Room created:', room.id);

// 2. Add players
roomService.joinRoom(room.id, 'Player2');
roomService.joinRoom(room.id, 'Player3');
roomService.joinRoom(room.id, 'Player4');
console.log('Players joined:', room.players.length);

// 3. Start Game
const gameState = gameService.startGame(room.id);
console.log('Game started. Phase:', gameState.phase);

// 4. Verify Deck and Hands
// 52 cards total (no jokers)
const totalCards = gameState.deck.length + Object.values(gameState.playersHand).reduce((acc, hand) => acc + hand.length, 0);
console.log('Total cards:', totalCards);

if (totalCards !== 52) {
    console.error('ERROR: Total cards should be 52, got', totalCards);
    process.exit(1);
} else {
    console.log('SUCCESS: Card count is correct.');
}

// 5. Verify Hand Size (12 per player)
const handSizes = Object.values(gameState.playersHand).map(h => h.length);
console.log('Hand sizes:', handSizes);
if (handSizes.every(s => s === 12)) {
    console.log('SUCCESS: All players have 12 cards.');
} else {
    console.error('ERROR: Hand sizes incorrect');
    process.exit(1);
}

// 6. Verify Hole Cards (4)
console.log('Hole cards:', gameState.deck.length);
if (gameState.deck.length === 4) {
    console.log('SUCCESS: 4 Hole cards.');
} else {
    console.error('ERROR: Hole cards incorrect');
    process.exit(1);
}

console.log('Tests Completed.');
