import React from 'react';
import { useLocalStorage } from '../../hooks/useLocalStorage.js';

export function CalendarReminder() {
  const [events] = useLocalStorage('calendar_events', []);
  const now = new Date();
  const upcoming = (events || [])
    .filter(e => e && e.date && new Date(e.date) >= now)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const next = upcoming[0];
  
  if (!next) return (
    <div className="border-t border-dashed border-border pt-2 mt-2 text-[10px] font-bold opacity-40 uppercase tracking-widest text-center">
      No upcoming events
    </div>
  );

  const daysUntil = Math.ceil((new Date(next.date) - now) / (1000 * 60 * 60 * 24));
  return (
    <div className="border-t border-dashed border-border pt-2 mt-2">
      <p className="text-[10px] font-bold opacity-50 uppercase tracking-widest mb-1">📅 upcoming</p>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 retro-border bg-primary text-primary-text flex items-center justify-center font-bold text-xs">{daysUntil}d</div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-xs truncate">{next.title || next.text || 'Event'}</p>
          <p className="text-[10px] opacity-50">{new Date(next.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
        </div>
      </div>
    </div>
  );
}
