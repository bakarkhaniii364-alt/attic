import React from 'react';
import { Mail } from 'lucide-react';

export function FloatingEnvelope({ doodle, onClick }) {
  return (
    <div className="envelope-wrapper drop-shadow-xl" style={{ top: `${doodle.y}vh`, left: `${doodle.x}vw` }} onClick={() => onClick(doodle)}>
      <div className="relative">
        <Mail size={64} className="text-white fill-[var(--primary)]" />
        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full border-2 border-white animate-pulse">NEW!</span>
      </div>
    </div>
  );
}
