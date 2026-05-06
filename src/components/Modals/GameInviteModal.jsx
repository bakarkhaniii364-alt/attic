import React from 'react';
import { Gamepad2 } from 'lucide-react';
import { RetroWindow, RetroButton } from '../UI.jsx';
import { playAudio } from '../../utils/audio.js';

export function GameInviteModal({ invite, partnerName, onAccept, onDecline, sfx }) {
  const titles = {
    tictactoe: 'Tic-Tac-Toe',
    'tic-tac-toe': 'Tic-Tac-Toe',
    pictionary: 'Pictionary',
    memory: 'Memory Match',
    wordle: 'Retro Word',
    sudoku: 'Sudoku',
    chess: 'Chess',
    quiz: 'Couples Quiz',
    '2048': '2048',
    typing: 'Typing Race',
    wyr: 'Would You Rather',
    uno: 'Retro Uno',
    retrouno: 'Retro Uno',
    othello: 'Othello',
    pool: '8-Ball Pool',
    '8-ballpool': '8-Ball Pool',
    '8ballpool': '8-Ball Pool',
    bluff: 'Cheat (Bluff)'
  };
  
  const gameId = invite?.metadata?.gameId || invite?.gameId || '';
  let title = titles[gameId?.toLowerCase().replace(/[^a-z0-9]/g, '')] || gameId || 'Game';
  
  if (title === 'Game' && invite?.text?.toLowerCase().includes('tic-tac-toe')) title = 'Tic-Tac-Toe';
  if (title === 'Game' && invite?.text?.toLowerCase().includes('chess')) title = 'Chess';
  if (title === 'Game' && invite?.text?.toLowerCase().includes('uno')) title = 'Retro Uno';
  if (title === 'Game' && invite?.text?.toLowerCase().includes('pool')) title = '8-Ball Pool';
  if (title === 'Game' && invite?.text?.toLowerCase().includes('typing')) title = 'Typing Race';

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
      <RetroWindow title="incoming_invite.exe" onClose={onDecline} className="max-w-md w-full border-4 border-dashed border-[var(--primary)] shadow-[0_0_50px_var(--primary)] animate-pulse" data-testid="game-invite-modal">
        <div className="flex flex-col items-center p-6 text-center">
          <Gamepad2 size={64} className="text-[var(--primary)] mb-4 animate-bounce" />
          <h2 className="text-2xl font-black uppercase mb-2">{partnerName} invited you!</h2>
          <h3 className="font-bold opacity-80 mb-8">They are waiting in the lobby for {title} ({invite?.metadata?.mode || invite?.mode || 'remote'}).</h3>
          <div className="flex gap-4 w-full">
            <RetroButton variant="white" onClick={() => { playAudio('click', sfx); onDecline(); }} className="flex-1 py-4 text-black border-dashed">Decline</RetroButton>
            <RetroButton variant="primary" onClick={() => { playAudio('click', sfx); onAccept(); }} className="flex-1 py-4 text-white font-black" data-testid="accept-game-btn">Accept & Join</RetroButton>
          </div>
        </div>
      </RetroWindow>
    </div>
  );
}
