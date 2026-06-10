import React, { useEffect } from 'react';
import { RetroWindow, RetroButton } from '../components/UI.jsx';
import { Trash2, Clock, Bell } from 'lucide-react';
import { useNotificationHistory } from '../hooks/useNotificationHistory.js';
import { useAuth } from '../context/instances.js';

function formatDistanceToNow(dateInput) {
  const diffInSeconds = Math.round((new Date(dateInput).getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const absDiff = Math.abs(diffInSeconds);
  if (absDiff < 60) return rtf.format(Math.round(diffInSeconds), 'second');
  if (absDiff < 3600) return rtf.format(Math.round(diffInSeconds / 60), 'minute');
  if (absDiff < 86400) return rtf.format(Math.round(diffInSeconds / 3600), 'hour');
  return rtf.format(Math.round(diffInSeconds / 86400), 'day');
}

export function NotificationView({ onClose, sfxEnabled }) {
  const { userId } = useAuth();
  const { history, markAllRead, clearHistory, lastReadAt } = useNotificationHistory(userId);

  // Mark all as read when opening this view
  useEffect(() => {
    markAllRead();
  }, [markAllRead]);

  return (
    <div className="w-full h-[100dvh] md:h-screen overflow-hidden flex flex-col pt-16 pb-4 px-4 md:p-4 transition-all duration-300">
      <RetroWindow
        title="notifications_feed.exe"
        onClose={onClose}
        sfx={sfxEnabled}
        className="w-full h-full flex flex-col max-w-4xl mx-auto"
        noPadding
      >
        <div className="flex flex-col h-full bg-[var(--bg-main)]">
          {/* Header */}
          <div className="p-4 sm:p-6 border-b-2 border-dashed border-border bg-window flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary flex items-center justify-center text-white retro-border retro-shadow-dark">
                <Bell size={20} />
              </div>
              <h1 className="font-black uppercase tracking-widest text-lg sm:text-xl">Notifications</h1>
            </div>
            <RetroButton 
              variant="white" 
              onClick={clearHistory} 
              disabled={history.length === 0}
              className="text-xs flex items-center gap-2"
            >
              <Trash2 size={14} /> <span className="hidden sm:inline">Clear All</span>
            </RetroButton>
          </div>
          
          {/* List */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-4">
            {history.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full opacity-50 text-center gap-3">
                <Bell size={48} className="opacity-20" />
                <p className="font-bold text-sm uppercase tracking-widest">No recent notifications</p>
              </div>
            ) : (
              history.map(notif => {
                const isNew = notif.timestamp > lastReadAt;
                return (
                  <div key={notif.id} className={`p-4 sm:p-5 retro-border bg-window hover:bg-accent/5 transition-colors flex flex-col gap-2 ${isNew ? 'retro-shadow-dark translate-y-[-2px]' : 'opacity-70 grayscale-[0.5] shadow-none'}`}>
                    <div className="flex justify-between items-start gap-4">
                      <span className={`text-base sm:text-lg leading-tight text-main-text break-words pr-2 ${isNew ? 'font-black' : 'font-bold'}`}>
                        {isNew && <span className="inline-block w-2.5 h-2.5 rounded-full bg-[var(--color-destructive)] mr-2.5 animate-pulse border border-white" />}
                        {notif.message}
                      </span>
                      <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest opacity-60 shrink-0 flex items-center gap-1.5 mt-1 bg-black/5 px-2 py-1 retro-border">
                        <Clock size={12} /> 
                        {formatDistanceToNow(notif.timestamp)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </RetroWindow>
    </div>
  );
}
