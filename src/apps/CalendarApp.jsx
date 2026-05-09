import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { RetroWindow, RetroButton } from '../components/UI.jsx';
import { useSync } from '../context/instances.js';
import { playAudio } from '../utils/audio.js';

export function CalendarApp({ onClose, sfx }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const { globalState, updateSyncState } = useSync();
  const events = globalState.calendar_events || [];
  const setEvents = (newEvents) => updateSyncState('calendar_events', newEvents);
  const [selectedDay, setSelectedDay] = useState(null);
  const [newTitle, setNewTitle] = useState('');
  const [newColor, setNewColor] = useState('var(--primary)');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const prevMonth = () => { playAudio('click', sfx); setCurrentDate(new Date(year, month - 1, 1)); };
  const nextMonth = () => { playAudio('click', sfx); setCurrentDate(new Date(year, month + 1, 1)); };

  const getDateStr = (day) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const getEventsForDay = (day) => events.filter(e => e.date === getDateStr(day));

  const addEvent = () => {
    if (!newTitle.trim() || !selectedDay) return;
    playAudio('click', sfx);
    setEvents([...events, { id: Date.now(), date: getDateStr(selectedDay), title: newTitle, color: newColor }]);
    setNewTitle('');
  };
  const removeEvent = (id) => { playAudio('click', sfx); setEvents(events.filter(e => e.id !== id)); };

  const blanks = Array.from({ length: firstDayOfWeek }, (_, i) => i);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <RetroWindow title="calendar.exe" onClose={onClose} className="w-full max-w-3xl h-[calc(100dvh-4rem)] max-h-[800px] flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <button onClick={prevMonth} className="p-2 retro-border retro-bg-window hover:bg-[var(--accent)] transition-colors"><ChevronLeft size={20}/></button>
        <h2 className="text-xl sm:text-2xl font-bold uppercase tracking-wider">{monthName}</h2>
        <button onClick={nextMonth} className="p-2 retro-border retro-bg-window hover:bg-[var(--accent)] transition-colors"><ChevronRight size={20}/></button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1 text-center font-bold text-[10px] sm:text-xs opacity-60">
        {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(d => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1 flex-1 auto-rows-fr overflow-y-auto">
        {blanks.map(i => <div key={`b-${i}`} className="retro-border opacity-20 bg-[var(--bg-main)]"></div>)}
        {days.map(d => {
          const dayEvents = getEventsForDay(d);
          const isToday = isCurrentMonth && today.getDate() === d;
          return (
            <div key={d} onClick={() => { playAudio('click', sfx); setSelectedDay(d); }} className={`retro-border p-1 flex flex-col cursor-pointer transition-colors ${isToday ? 'ring-2 ring-[var(--primary)] retro-bg-accent' : dayEvents.length > 0 ? 'retro-bg-window' : 'retro-bg-window hover:bg-[var(--accent)]'} ${selectedDay === d ? 'retro-shadow-dark' : ''}`}>
              <span className={`font-bold text-xs ${isToday ? 'text-[var(--primary)]' : ''}`}>{d}</span>
              {dayEvents.slice(0, 2).map(ev => (
                <div key={ev.id} className="w-full h-1 rounded-full mt-auto" style={{ backgroundColor: ev.color || 'var(--primary)' }}></div>
              ))}
            </div>
          );
        })}
      </div>
      {selectedDay && (
        <div className="mt-3 p-3 retro-border retro-bg-accent border-dashed">
          <h3 className="font-bold text-sm mb-2">{monthName.split(' ')[0]} {selectedDay}</h3>
          {getEventsForDay(selectedDay).map(ev => (
            <div key={ev.id} className="flex items-center gap-2 mb-1 text-sm">
              <div className="w-3 h-3 rounded-full retro-border" style={{ backgroundColor: ev.color }}></div>
              <span className="flex-1 font-bold">{ev.title}</span>
              <button onClick={() => removeEvent(ev.id)} className="text-red-500 hover:text-red-700 text-xs font-bold">✕</button>
            </div>
          ))}
          <div className="flex gap-2 mt-2">
            <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && addEvent()} placeholder="Add event..." className="flex-1 p-1 retro-border retro-bg-window text-sm focus:outline-none" />
            <select value={newColor} onChange={e => setNewColor(e.target.value)} className="p-1 retro-border retro-bg-window text-xs font-bold">
              <option value="var(--primary)">❤️</option>
              <option value="var(--secondary)">💙</option>
              <option value="#4ade80">💚</option>
              <option value="#f59e0b">🧡</option>
            </select>
            <RetroButton onClick={addEvent} className="px-3 py-1 text-xs">Add</RetroButton>
          </div>
        </div>
      )}
    </RetroWindow>
  );
}
