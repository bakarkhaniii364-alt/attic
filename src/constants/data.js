export const INITIAL_CHAT = [
  { id: 1, sender: 'partner', type: 'text', text: 'good morning! ❤️', time: '09:00 AM', status: 'read' },
  { id: 2, sender: 'me', type: 'text', text: 'morning! want to play some games?', time: '09:05 AM', reactions: ['🥰'], status: 'read' }
];

export const PICTIONARY_CATEGORIES = {
  animals: ['CAT', 'DOG', 'ELEPHANT', 'FISH', 'BIRD', 'SNAKE', 'RABBIT', 'MOUSE'],
  objects: ['CUP', 'HOUSE', 'CAR', 'CLOCK', 'COMPUTER', 'KEYBOARD', 'CHAIR', 'PHONE'],
  hard: ['MOUNTAIN', 'BASEBALL', 'BICYCLE', 'ASTRONAUT', 'HOSPITAL', 'VACUUM', 'PYRAMID']
};

export const WORDS_FALLBACK = { easy: ["LOVE", "CUTE", "HUGS"], medium: ["SWEET", "HEART", "SMILE"], hard: ["CARING", "LOVING", "GENTLE"] };
export const MEMORY_EMOJIS = { easy: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼'], medium: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐯','🦁'], hard: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐯','🦁','🐮','🐷'] };
export const INITIAL_CHESS_BOARD = [ 'bR','bN','bB','bQ','bK','bB','bN','bR', 'bP','bP','bP','bP','bP','bP','bP','bP', ...Array(32).fill(null), 'wP','wP','wP','wP','wP','wP','wP','wP', 'wR','wN','wB','wQ','wK','wB','wN','wR' ];
export const CHESS_PIECE_MAP = { 'wK': '♔', 'wQ': '♕', 'wR': '♖', 'wB': '♗', 'wN': '♘', 'wP': '♙', 'bK': '♚', 'bQ': '♛', 'bR': '♜', 'bB': '♝', 'bN': '♞', 'bP': '♟' };
