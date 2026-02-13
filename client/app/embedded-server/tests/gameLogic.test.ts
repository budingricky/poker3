import { gameService } from '../api/services/gameService';
import { roomService } from '../api/services/roomService';
import { RoomStatus } from '../api/models/types';

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

console.log('\nRunning Auto-Skip & Next Round Tests...')
try {
  const room = roomService.createRoom('A', 'test-auto-skip')
  const p2 = roomService.joinRoom(room.id, 'B').player
  const p3 = roomService.joinRoom(room.id, 'C').player
  const p4 = roomService.joinRoom(room.id, 'D').player

  gameService.startGame(room.id)
  const gamesMap = (gameService as any).games as Map<string, any>
  const g = gamesMap.get(room.id)
  if (!g) throw new Error('game state not found')

  g.phase = 'PLAYING'
  g.currentTurn = room.hostId
  g.lastMove = null
  g.passCount = 0

  const mk = (code: string, suit: string, rank: number) => ({ code, suit, rank })
  g.playersHand = {
    [room.hostId]: [mk('H3', 'H', 3)],
    [p2.id]: [mk('H4', 'H', 4)],
    [p3.id]: [mk('H5', 'H', 5)],
    [p4.id]: [mk('H6', 'H', 6)],
  }

  gameService.handlePlayCards(room.id, room.hostId, ['H3'])
  const after = gamesMap.get(room.id)
  if (after.currentTurn !== room.hostId) throw new Error('max play should keep turn')
  console.log('SUCCESS: max play keeps turn')

  after.phase = 'FINISHED'
  room.status = RoomStatus.FINISHED
  ;(gameService as any).nextRoundReadyByRoom?.delete?.(room.id)
  gameService.markNextRoundReady(room.id, room.hostId)
  gameService.markNextRoundReady(room.id, p2.id)
  gameService.markNextRoundReady(room.id, p3.id)
  gameService.markNextRoundReady(room.id, p4.id)
  const restarted = gamesMap.get(room.id)
  if (!restarted || restarted.phase !== 'BIDDING') throw new Error('next round should restart game')
  console.log('SUCCESS: next round restarts game')
} catch (e) {
  console.error('FAILED: Auto-Skip & Next Round Tests', e)
  process.exitCode = 1
}

console.log('\nRunning Consecutive Triplets & Undo Tests...')
try {
  const room = roomService.createRoom('A', 'test-combos')
  const p2 = roomService.joinRoom(room.id, 'B').player
  const p3 = roomService.joinRoom(room.id, 'C').player
  const p4 = roomService.joinRoom(room.id, 'D').player

  gameService.startGame(room.id)
  const gamesMap = (gameService as any).games as Map<string, any>
  const g = gamesMap.get(room.id)
  if (!g) throw new Error('game state not found')

  g.phase = 'PLAYING'
  g.currentTurn = room.hostId
  g.lastMove = null
  g.passCount = 0

  const mk = (code: string, suit: string, rank: number) => ({ code, suit, rank })
  g.playersHand = {
    [room.hostId]: [mk('H4', 'H', 4), mk('H6', 'H', 6), mk('D4', 'D', 4), mk('C4', 'C', 4), mk('D5', 'D', 5), mk('C5', 'C', 5), mk('S5', 'S', 5)],
    [p2.id]: [mk('H5', 'H', 5)],
    [p3.id]: [mk('H7', 'H', 7)],
    [p4.id]: [mk('H8', 'H', 8)],
  }

  gameService.handlePlayCards(room.id, room.hostId, ['D4', 'C4', 'H4', 'D5', 'C5', 'S5'])
  const afterPlay = gamesMap.get(room.id)
  if (afterPlay.lastMove?.pattern?.type !== 'CONSECUTIVE_TRIPLETS') throw new Error('expected CONSECUTIVE_TRIPLETS')
  console.log('SUCCESS: consecutive triplets recognized')

  gameService.undoLastMove(room.id, room.hostId)
  const afterUndo = gamesMap.get(room.id)
  if (afterUndo.lastMove !== null) throw new Error('expected lastMove restored to null')
  const myHandCodes = (afterUndo.playersHand[room.hostId] || []).map((c: any) => c.code)
  if (!myHandCodes.includes('D4') || !myHandCodes.includes('S5')) throw new Error('expected cards restored to hand')
  console.log('SUCCESS: undo restores previous state')
} catch (e) {
  console.error('FAILED: Consecutive Triplets & Undo Tests', e)
  process.exitCode = 1
}

console.log('\nRunning K-Max Sequence Rule Tests...')
try {
  const room = roomService.createRoom('A', 'test-seq-kmax')
  const p2 = roomService.joinRoom(room.id, 'B').player
  const p3 = roomService.joinRoom(room.id, 'C').player
  const p4 = roomService.joinRoom(room.id, 'D').player

  gameService.startGame(room.id)
  const gamesMap = (gameService as any).games as Map<string, any>
  const g = gamesMap.get(room.id)
  if (!g) throw new Error('game state not found')

  g.phase = 'PLAYING'
  g.currentTurn = room.hostId
  g.lastMove = null
  g.passCount = 0

  const mk = (code: string, suit: string, rank: number) => ({ code, suit, rank })
  g.playersHand = {
    [room.hostId]: [
      mk('H9', 'H', 9),
      mk('H10', 'H', 10),
      mk('H11', 'H', 11),
      mk('H12', 'H', 12),
      mk('H13', 'H', 13),
      mk('H14', 'H', 14),
      mk('D9', 'D', 9),
      mk('C9', 'C', 9),
      mk('D10', 'D', 10),
      mk('C10', 'C', 10),
      mk('D11', 'D', 11),
      mk('C11', 'C', 11),
      mk('D12', 'D', 12),
      mk('C12', 'C', 12),
      mk('D13', 'D', 13),
      mk('C13', 'C', 13),
      mk('S14', 'S', 14),
      mk('C14', 'C', 14),
      mk('D14', 'D', 14),
    ],
    [p2.id]: [mk('S3', 'S', 3)],
    [p3.id]: [mk('S4', 'S', 4)],
    [p4.id]: [mk('S5', 'S', 5)],
  }
  g.playedCardsByPlayer = { [room.hostId]: [], [p2.id]: [], [p3.id]: [], [p4.id]: [] }

  gameService.handlePlayCards(room.id, room.hostId, ['H9', 'H10', 'H11', 'H12', 'H13'])
  if (gamesMap.get(room.id).lastMove?.pattern?.type !== 'STRAIGHT') throw new Error('expected STRAIGHT to K')
  console.log('SUCCESS: straight can end at K')

  gameService.undoLastMove(room.id, room.hostId)
  let threw = false
  try {
    gameService.handlePlayCards(room.id, room.hostId, ['H10', 'H11', 'H12', 'H13', 'H14'])
  } catch {
    threw = true
  }
  if (!threw) throw new Error('expected straight ending at A to be invalid')
  console.log('SUCCESS: straight ending at A is invalid')

  gameService.handlePlayCards(room.id, room.hostId, ['D9', 'C9', 'D10', 'C10', 'D11', 'C11', 'D12', 'C12', 'D13', 'C13'])
  if (gamesMap.get(room.id).lastMove?.pattern?.type !== 'CONSECUTIVE_PAIRS') throw new Error('expected CONSECUTIVE_PAIRS to K')
  console.log('SUCCESS: consecutive pairs can end at K')

  gameService.undoLastMove(room.id, room.hostId)
  threw = false
  try {
    gameService.handlePlayCards(room.id, room.hostId, ['S14', 'C14', 'D14', 'H13', 'D13', 'C13'])
  } catch {
    threw = true
  }
  if (!threw) throw new Error('expected consecutive triplets containing A to be invalid')
  console.log('SUCCESS: sequences above K are invalid')
} catch (e) {
  console.error('FAILED: K-Max Sequence Rule Tests', e)
  process.exitCode = 1
}

console.log('\nRunning Pair/Triplet Sequence Play Tests...')
try {
  const room = roomService.createRoom('A', 'test-seq-play')
  const p2 = roomService.joinRoom(room.id, 'B').player
  const p3 = roomService.joinRoom(room.id, 'C').player
  const p4 = roomService.joinRoom(room.id, 'D').player

  gameService.startGame(room.id)
  const gamesMap = (gameService as any).games as Map<string, any>
  const g = gamesMap.get(room.id)
  if (!g) throw new Error('game state not found')

  g.phase = 'PLAYING'
  g.currentTurn = room.hostId
  g.lastMove = null
  g.passCount = 0
  g.diggerId = room.hostId

  const mk = (code: string, suit: string, rank: number) => ({ code, suit, rank })
  g.playersHand = {
    [room.hostId]: [
      mk('H4', 'H', 4), mk('D4', 'D', 4), mk('C4', 'C', 4),
      mk('H5', 'H', 5), mk('D5', 'D', 5), mk('C5', 'C', 5),
      mk('H6', 'H', 6), mk('D6', 'D', 6), mk('C6', 'C', 6),
      mk('S4', 'S', 4), mk('S5', 'S', 5), mk('S6', 'S', 6),
      mk('H7', 'H', 7), mk('D7', 'D', 7),
      mk('H8', 'H', 8), mk('D8', 'D', 8),
      mk('H9', 'H', 9), mk('D9', 'D', 9),
      mk('H10', 'H', 10), mk('D10', 'D', 10),
      mk('H11', 'H', 11), mk('D11', 'D', 11),
      mk('H12', 'H', 12), mk('D12', 'D', 12),
      mk('H13', 'H', 13), mk('D13', 'D', 13),
      mk('H14', 'H', 14), mk('D14', 'D', 14),
    ],
    [p2.id]: [mk('S3', 'S', 3)],
    [p3.id]: [mk('S10', 'S', 10)],
    [p4.id]: [mk('S11', 'S', 11)],
  }
  g.playedCardsByPlayer = { [room.hostId]: [], [p2.id]: [], [p3.id]: [], [p4.id]: [] }

  let threw = false
  try {
    gameService.handlePlayCards(room.id, room.hostId, ['H4', 'D4', 'H5', 'D5'])
  } catch {
    threw = true
  }
  if (!threw) throw new Error('expected 4455 (2 consecutive pairs) to be invalid')
  console.log('SUCCESS: 4455 (2 consecutive pairs) is invalid')

  gameService.handlePlayCards(room.id, room.hostId, ['H4', 'D4', 'H5', 'D5', 'H6', 'D6'])
  if (gamesMap.get(room.id).lastMove?.pattern?.type !== 'CONSECUTIVE_PAIRS') throw new Error('expected 445566 to be consecutive pairs')
  console.log('SUCCESS: 445566 playable')

  gameService.undoLastMove(room.id, room.hostId)
  gameService.handlePlayCards(room.id, room.hostId, ['H7', 'D7', 'H8', 'D8', 'H9', 'D9'])
  if (gamesMap.get(room.id).lastMove?.pattern?.type !== 'CONSECUTIVE_PAIRS') throw new Error('expected 778899 to be consecutive pairs')
  console.log('SUCCESS: 778899 playable')

  gameService.undoLastMove(room.id, room.hostId)
  gameService.handlePlayCards(room.id, room.hostId, ['H4', 'D4', 'C4', 'H5', 'D5', 'C5'])
  if (gamesMap.get(room.id).lastMove?.pattern?.type !== 'CONSECUTIVE_TRIPLETS') throw new Error('expected 444555 to be consecutive triplets')
  console.log('SUCCESS: 444555 playable')

  gameService.undoLastMove(room.id, room.hostId)
  gameService.handlePlayCards(room.id, room.hostId, ['H4', 'D4', 'C4', 'H5', 'D5', 'C5', 'H6', 'D6', 'C6'])
  if (gamesMap.get(room.id).lastMove?.pattern?.type !== 'CONSECUTIVE_TRIPLETS') throw new Error('expected 444555666 to be consecutive triplets')
  console.log('SUCCESS: 444555666 playable')

  gameService.undoLastMove(room.id, room.hostId)
  threw = false
  try {
    gameService.handlePlayCards(room.id, room.hostId, ['H10', 'D10', 'H11', 'D11', 'H12', 'D12', 'H13', 'D13', 'H14', 'D14'])
  } catch {
    threw = true
  }
  if (!threw) throw new Error('expected consecutive pairs containing A to be invalid')
  console.log('SUCCESS: consecutive pairs containing A are invalid')
} catch (e) {
  console.error('FAILED: Pair/Triplet Sequence Play Tests', e)
  process.exitCode = 1
}

console.log('\nRunning Rejoin After Finish Tests...')
try {
  const room = roomService.createRoom('A', 'test-rejoin-finish')
  const p2 = roomService.joinRoom(room.id, 'B').player
  const p3 = roomService.joinRoom(room.id, 'C').player
  const p4 = roomService.joinRoom(room.id, 'D').player

  gameService.startGame(room.id)
  const gamesMap = (gameService as any).games as Map<string, any>
  const g = gamesMap.get(room.id)
  if (!g) throw new Error('game state not found')

  g.phase = 'PLAYING'
  g.currentTurn = room.hostId
  g.lastMove = null
  g.passCount = 0
  g.diggerId = room.hostId

  g.playersHand = {
    [room.hostId]: [{ code: 'H3', suit: 'H', rank: 3 }],
    [p2.id]: [{ code: 'H4', suit: 'H', rank: 4 }],
    [p3.id]: [{ code: 'H5', suit: 'H', rank: 5 }],
    [p4.id]: [{ code: 'H6', suit: 'H', rank: 6 }],
  }

  gameService.handlePlayCards(room.id, room.hostId, ['H3'])
  const stateForP2 = gameService.getGameState(room.id, p2.id)
  if (stateForP2.phase !== 'FINISHED') throw new Error('expected finished')
  if (!stateForP2.winnerId) throw new Error('expected winnerId on finished state')
  console.log('SUCCESS: finished state includes winnerId')
} catch (e) {
  console.error('FAILED: Rejoin After Finish Tests', e)
  process.exitCode = 1
}
