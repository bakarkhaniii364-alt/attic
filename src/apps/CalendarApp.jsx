import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Heart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { RetroWindow, RetroButton } from '../components/UI.jsx';
import { DayDetailsModal } from '../components/DayDetailsModal.jsx';
import { useSync } from '../context/instances.js';
import { playAudio } from '../utils/audio.js';

export function CalendarApp({ onClose, sfx }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const { globalState, updateSyncState } = useSync();
  const events = globalState.calendar_events || [];
  const setEvents = (newEvents) => updateSyncState('calendar_events', newEvents);
  const [selectedDayForModal, setSelectedDayForModal] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const navigate = useNavigate();
  const coupleData = globalState.couple_data || {};
  const anniversary = coupleData.anniversary;

  const COLOR_OPTIONS = [
    { value: 'var(--primary)', label: '🌹', name: 'Date Night' },
    { value: 'var(--secondary)', label: '🍿', name: 'Watch Party' },
    { value: '#4ade80', label: '🎉', name: 'Milestone' },
    { value: '#3b82f6', label: '✈️', name: 'Outing' },
    { value: '#f59e0b', label: '🧹', name: 'Task' }
  ];

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

  const handleDayClick = (day) => {
    playAudio('click', sfx);
    setSelectedDayForModal(day);
    setShowModal(true);
  };

  const handleAddEvent = (title, color) => {
    if (!title.trim() || !selectedDayForModal) return;
    const category = COLOR_OPTIONS.find(c => c.value === color);
    const emoji = category ? category.label : '';
    const finalTitle = title.startsWith(emoji) ? title : `${emoji} ${title}`.trim();
    setEvents([...events, { id: Date.now(), date: getDateStr(selectedDayForModal), title: finalTitle, color }]);
  };

  const handleUpdateEvent = (id, title, color) => {
    setEvents(events.map(e => e.id === id ? { ...e, title, color } : e));
  };

  const handleDeleteEvent = (id) => {
    setEvents(events.filter(e => e.id !== id));
  };

  const blanks = Array.from({ length: firstDayOfWeek }, (_, i) => i);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <RetroWindow title="calendar.exe" onClose={onClose} className="w-full max-w-3xl h-[calc(100dvh-4rem)] max-h-[800px] flex flex-col">
      <div 
        onClick={() => {
          playAudio('click', sfx);
          if (onClose) onClose();
          navigate('/settings?tab=relationship');
        }}
        className="bg-accent/10 retro-border border-accent/30 p-2 mb-4 text-center cursor-pointer hover:bg-accent/20 transition-colors"
      >
        {anniversary ? (
           <span className="text-sm font-black uppercase tracking-widest text-accent flex items-center justify-center gap-2">
              <Heart size={14} fill="currentColor" /> Together for {Math.floor((new Date() - new Date(anniversary)) / (1000 * 60 * 60 * 24))} days <Heart size={14} fill="currentColor" />
           </span>
        ) : (
           <span className="text-sm font-black uppercase tracking-widest text-accent/70 hover:text-accent">
              Set anniversary date to show together time
           </span>
        )}
      </div>
      <div className="flex justify-between items-center mb-6 bg-black/5 p-2 retro-border border-dashed">
        <button onClick={prevMonth} className="w-12 h-12 flex items-center justify-center retro-border retro-shadow-dark bg-window hover:bg-accent hover:text-accent-text transition-all group shrink-0"><ChevronLeft size={28} className="group-hover:-translate-x-1 transition-transform" /></button>
        <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-widest text-main-text text-center flex-1">{monthName}</h2>
        <button onClick={nextMonth} className="w-12 h-12 flex items-center justify-center retro-border retro-shadow-dark bg-window hover:bg-accent hover:text-accent-text transition-all group shrink-0"><ChevronRight size={28} className="group-hover:translate-x-1 transition-transform" /></button>
      </div>
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-2 text-center font-black text-[10px] sm:text-xs opacity-60 uppercase tracking-widest">
        {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(d => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2 flex-1 auto-rows-fr">
        {blanks.map(i => <div key={`b-${i}`} className="retro-border border-dashed opacity-30 bg-black/5"></div>)}
        {days.map(d => {
          const dayEvents = getEventsForDay(d);
          const isToday = isCurrentMonth && today.getDate() === d;
          return (
            <div 
              key={d} 
              onClick={() => handleDayClick(d)}
              className={`retro-border p-1.5 sm:p-2 flex flex-col cursor-pointer transition-all hover:-translate-y-0.5 active:translate-y-0 relative group overflow-hidden ${isToday ? 'bg-accent/20 border-accent/50 text-accent shadow-inner' : dayEvents.length > 0 ? 'bg-window hover:bg-accent/10' : 'bg-window/50 hover:bg-window text-main-text/80 hover:text-main-text'}`}
            >
              <span className={`font-black text-sm sm:text-base z-10 ${isToday ? 'text-accent' : ''}`}>{d}</span>
              
              {/* Desktop list of events */}
              <div className="hidden sm:flex flex-col gap-1 mt-auto z-10 overflow-hidden">
                {dayEvents.slice(0, 3).map(ev => (
                  <div key={ev.id} className="text-[9px] font-bold px-1 py-0.5 truncate bg-black/10 text-main-text" style={{ borderLeft: `3px solid ${ev.color || 'var(--primary)'}` }}>
                    {ev.title}
                  </div>
                ))}
              </div>

              {/* Mobile dots for events */}
              <div className="flex sm:hidden justify-start gap-1 mt-auto z-10 flex-wrap">
                {dayEvents.slice(0, 4).map(ev => (
                  <div key={ev.id} className="w-2 h-2" style={{ backgroundColor: ev.color || 'var(--primary)' }}></div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {showModal && selectedDayForModal && (
        <DayDetailsModal
          date={getDateStr(selectedDayForModal)}
          dayEvents={getEventsForDay(selectedDayForModal)}
          onClose={() => setShowModal(false)}
          onAddEvent={handleAddEvent}
          onUpdateEvent={handleUpdateEvent}
          onDeleteEvent={handleDeleteEvent}
          sfx={sfx}
          colorOptions={COLOR_OPTIONS}
        />
      )}
    </RetroWindow>
  );
}
