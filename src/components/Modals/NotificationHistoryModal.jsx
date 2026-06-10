import React from 'react';
import { RetroWindow, RetroButton } from '../UI.jsx';
import { Trash2, Clock, Bell } from 'lucide-react';

function formatDistanceToNow(dateInput) {
  const diffInSeconds = Math.round((new Date(dateInput).getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const absDiff = Math.abs(diffInSeconds);
  if (absDiff < 60) return rtf.format(Math.round(diffInSeconds), 'second');
  if (absDiff < 3600) return rtf.format(Math.round(diffInSeconds / 60), 'minute');
  if (absDiff < 86400) return rtf.format(Math.round(diffInSeconds / 3600), 'hour');
  return rtf.format(Math.round(diffInSeconds / 86400), 'day');
}

export function NotificationHistoryModal({ notifications, lastReadAt, onClose, onClear, sfxEnabled }) {
  return (
    <div className="fixed inset-0 z-[var(--z-modal)] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="w-full max-w-2xl animate-in zoom-in-95">
        <RetroWindow
          title="notifications.log"
          onClose={onClose}
          sfx={sfxEnabled}
          className="max-h-[80vh] flex flex-col"
          noPadding
        >
          <div className="flex flex-col h-full">
            <div className="p-4 border-b border-dashed border-border bg-window/50 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-primary" />
                <h3 className="font-black uppercase tracking-widest text-sm">Notification History</h3>
              </div>
              <RetroButton 
                variant="white" 
                size="sm" 
                onClick={onClear} 
                disabled={notifications.length === 0}
                className="text-[10px]"
              >
                <Trash2 size={12} className="mr-1" /> Clear All
              </RetroButton>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-[200px]">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full opacity-50 text-center gap-2">
                  <Bell size={32} className="opacity-20" />
                  <p className="font-bold text-xs">No recent notifications</p>
                </div>
              ) : (
                notifications.map(notif => {
                  const isNew = notif.timestamp > lastReadAt;
                  return (
                    <div key={notif.id} className={`p-4 retro-border bg-window hover:bg-accent/5 transition-colors flex flex-col gap-1 ${isNew ? '' : 'opacity-60 grayscale-[0.3]'}`}>
                      <div className="flex justify-between items-start gap-3">
                        <span className={`text-base leading-tight text-main-text break-words pr-2 ${isNew ? 'font-black' : 'font-bold'}`}>
                          {isNew && <span className="inline-block w-2 h-2 rounded-full bg-[var(--color-destructive)] mr-2 animate-pulse" />}
                          {notif.message}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-widest opacity-60 shrink-0 flex items-center gap-1 mt-1">
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
    </div>
  );
}
