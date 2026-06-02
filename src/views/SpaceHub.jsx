import React from 'react';
import { Pen, Brush, Clock, Moon, ListTodo, Calendar as CalendarIcon, Image as ImageIcon, FileText, Heart, MessageCircle, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { RetroWindow, AppIcon } from '../components/UI.jsx';
import { playAudio } from '../utils/audio.js';
import { useMobile } from '../hooks/useMobile.js';

export function SpaceHub({ onClose, sfx }) {
  const navigate = useNavigate();
  const isMobile = useMobile();
  
  const nav = (path) => {
    playAudio('click', sfx);
    navigate(path);
  };

  return (
    <div className={`w-full h-full flex flex-col p-4 md:p-8 animate-in slide-in-from-right-8 duration-300 md:w-[800px] md:mx-auto ${isMobile ? 'pb-safe-navbar' : ''}`}>
      <RetroWindow title="space.sys" onClose={onClose} className="w-full flex-1">
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-6 p-4">
          <AppIcon icon={<MessageSquare size={24} strokeWidth={1.5} />} label="Chat"   color="#3b82f6" onClick={() => nav('/chat')} />
          <AppIcon icon={<Pen          size={24} strokeWidth={1.5} />} label="Doodle"   color="#ec4899" onClick={() => nav('/doodle')} />
          <AppIcon icon={<Brush        size={24} strokeWidth={1.5} />} label="Pixels"   color="#f97316" onClick={() => nav('/pixelart')} />
          <AppIcon icon={<Clock        size={24} strokeWidth={1.5} />} label="Capsule"  color="#10b981" onClick={() => nav('/capsule')} />
          <AppIcon icon={<Moon         size={24} strokeWidth={1.5} />} label="Dreams"   color="#6366f1" onClick={() => nav('/dreams')} />
          <AppIcon icon={<ListTodo     size={24} strokeWidth={1.5} />} label="Lists"    color="#ef4444" onClick={() => nav('/lists')} />
          <AppIcon icon={<CalendarIcon size={24} strokeWidth={1.5} />} label="Calendar" color="#06b6d4" onClick={() => nav('/calendar')} />
          <AppIcon icon={<ImageIcon    size={24} strokeWidth={1.5} />} label="Album"    color="#eab308" onClick={() => nav('/scrapbook')} />
          <AppIcon icon={<FileText     size={24} strokeWidth={1.5} />} label="Notes"    color="#0ea5e9" onClick={() => nav('/notes')} />
          <AppIcon icon={<Heart        size={24} strokeWidth={1.5} />} label="Story"    color="#f43f5e" onClick={() => nav('/resume')} />
          <AppIcon icon={<MessageCircle size={24} strokeWidth={1.5} />} label="Daily Q"  color="#f59e0b" onClick={() => nav('/daily-q')} />
        </div>
      </RetroWindow>
    </div>
  );
}
