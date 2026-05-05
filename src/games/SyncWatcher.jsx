import React, { useState, useRef, useEffect } from 'react';
// IMPORT FIXED: No more lazy(), this guarantees the playerRef has the .seekTo() method
import ReactPlayer from 'react-player';
import { RetroWindow, RetroButton } from '../components/UI.jsx';
import { playAudio } from '../utils/audio.js';
import { Play, Pause, RotateCcw, RotateCw, Heart, Link as LinkIcon, MessageSquare, Volume2, VolumeX, Maximize2, Settings, Globe } from 'lucide-react';
import { useSync } from '../context/SyncContext.jsx';
import { useGlobalSync } from '../hooks/useSupabaseSync.js';

export default function SyncWatcher({ onBack, sfx, userId, onShareToChat }) {
    const { broadcast, roomProfiles } = useSync();
    
    // Database Synced State (So late-joiners see the right screen)
    const [syncedUrl, setSyncedUrl] = useGlobalSync('sync_watcher_url', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    const [mode, setMode] = useGlobalSync('sync_watcher_mode', 'video');
    
    const myName = roomProfiles?.[userId]?.name || 'You';

    // Local UI State
    const [inputUrl, setInputUrl] = useState('');
    const [volume, setVolume] = useState(0.8);
    const [muted, setMuted] = useState(false);
    const [playing, setPlaying] = useState(false);
    
    // TIMELINE FIX: Separate fraction (for slider) from seconds (for text display)
    const [playedFraction, setPlayedFraction] = useState(0); 
    const [playedSeconds, setPlayedSeconds] = useState(0); 
    const [duration, setDuration] = useState(0);
    
    // Ephemeral State (Fixes chat database spam)
    const [ephemeralChat, setEphemeralChat] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [hearts, setHearts] = useState([]);
    const [loadError, setLoadError] = useState(null);

    const playerRef = useRef(null);
    const wrapperRef = useRef(null);
    const isSeeking = useRef(false);
    const chatEndRef = useRef(null);

    // Auto-scroll chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [ephemeralChat]);

    // --- HIGH SPEED NETWORKING ---
    useEffect(() => {
        const handleBroadcast = ({ detail: { event, payload } }) => {
            if (event === 'watcher_chat') {
                setEphemeralChat(prev => [...prev, payload]);
            }
            if (event === 'watcher_heart') {
                const newHeart = { id: Date.now(), x: payload.x, y: payload.y };
                setHearts(prev => [...prev, newHeart]);
                setTimeout(() => setHearts(prev => prev.filter(h => h.id !== newHeart.id)), 2000);
            }
            if (event === 'watcher_control' && playerRef.current) {
                if (payload.action === 'PLAY') {
                    setPlaying(true);
                }
                if (payload.action === 'PAUSE') {
                    setPlaying(false);
                }
                if (payload.action === 'SEEK_FRACTION') {
                    playerRef.current.seekTo(payload.time, 'fraction');
                    setPlayedFraction(payload.time);
                }
                if (payload.action === 'SEEK_SECONDS') {
                    playerRef.current.seekTo(payload.time, 'seconds');
                    setPlayedSeconds(payload.time);
                }
            }
        };

        window.addEventListener('sync_broadcast', handleBroadcast);
        return () => window.removeEventListener('sync_broadcast', handleBroadcast);
    }, []);

    // --- CONTROLS ---
    const handlePlayPause = () => {
        playAudio('click', sfx);
        const newPlayState = !playing;
        setPlaying(newPlayState);
        broadcast('watcher_control', { action: newPlayState ? 'PLAY' : 'PAUSE' });
    };

    const handleSkip = (seconds) => {
        playAudio('click', sfx);
        if (playerRef.current) {
            const currentTime = playerRef.current.currentTime || 0;
            const newTime = Math.max(0, currentTime + seconds);
            
            playerRef.current.currentTime = newTime;
            setPlayedSeconds(newTime);
            broadcast('watcher_control', { action: 'SEEK_SECONDS', time: newTime });
        }
    };

    const handleSeekMouseUp = (e) => {
        const newFraction = parseFloat(e.target.value);
        if (playerRef.current) {
            const dur = playerRef.current.duration;
            if (dur > 0) playerRef.current.currentTime = newFraction * dur;
            broadcast('watcher_control', { action: 'SEEK_FRACTION', time: newFraction });
        }
        isSeeking.current = false;
    };

    const handleInvite = () => {
        playAudio('click', sfx);
        broadcast('watchparty_invite', { 
            sender: userId, 
            senderName: myName,
            url: syncedUrl,
            timestamp: Date.now() 
        });
        if (onShareToChat) {
            onShareToChat(`Join me for a watch party!`, null, { type: 'watchparty_invite', url: syncedUrl });
        }
        setEphemeralChat(prev => [...prev, { id: Date.now(), sender: 'SYSTEM', text: 'Invite sent to partner!', isMe: true }]);
    };

    const handleUrlChange = (e) => setInputUrl(e.target.value);
    const handleLoadUrl = () => {
        if (!inputUrl) return;
        playAudio('click', sfx);
        setSyncedUrl(inputUrl.trim());
        setInputUrl('');
        setLoadError(null);
        broadcast('watcher_chat', { id: Date.now(), sender: 'SYSTEM', text: `${myName} loaded a new URL.` });
    };

    const sendReaction = () => {
        playAudio('click', sfx);
        const x = Math.random() * 80 + 10;
        const y = Math.random() * 20 + 70;
        
        const newHeart = { id: Date.now(), x, y };
        setHearts(prev => [...prev, newHeart]);
        setTimeout(() => setHearts(prev => prev.filter(h => h.id !== newHeart.id)), 2000);
        broadcast('watcher_heart', { x, y });
    };

    const sendChat = (e) => {
        e.preventDefault();
        if (!chatInput.trim()) return;
        playAudio('click', sfx);
        
        const msg = { id: Date.now(), sender: myName, text: chatInput, isMe: true };
        setEphemeralChat(prev => [...prev, msg]);
        broadcast('watcher_chat', { ...msg, isMe: false }); 
        setChatInput('');
    };

    const toggleFullscreen = () => {
        playAudio('click', sfx);
        if (wrapperRef.current) {
            if (document.fullscreenElement) document.exitFullscreen();
            else wrapperRef.current.requestFullscreen();
        }
    };

    // FIX: Protected against NaN crashes
    const formatTime = (sec) => {
        if (isNaN(sec) || sec === null || sec === undefined || sec === 0) return "0:00";
        const date = new Date(sec * 1000);
        const hh = date.getUTCHours();
        const mm = date.getUTCMinutes();
        const ss = date.getUTCSeconds().toString().padStart(2, '0');
        if (hh > 0) return `${hh}:${mm.toString().padStart(2, '0')}:${ss}`;
        return `${mm}:${ss}`;
    };

    return (
        <RetroWindow title={`sync_watcher.exe`} className="w-full max-w-6xl h-[calc(100dvh-4rem)] max-h-[850px] flex flex-col shadow-2xl" onClose={onBack} confirmOnClose sfx={sfx} noPadding>
            
            {/* Header Status Bar */}
            <div className="bg-border text-window p-2 flex justify-between items-center font-bold px-4 flex-shrink-0 text-[10px] uppercase tracking-widest border-b-[3px] border-border">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-2">Shared Sync <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse border border-black/50"></span> Connected</span>
                  
                  {/* BROWSER / VIDEO TOGGLE */}
                  <div className="flex bg-black/30 rounded p-0.5 retro-border shadow-inner">
                    <button onClick={() => setMode('video')} className={`px-3 py-1 rounded-sm transition-colors ${mode === 'video' ? 'bg-white text-black font-black' : 'text-white/80 hover:text-white'}`}>VIDEO</button>
                    <button onClick={() => setMode('browser')} className={`px-3 py-1 rounded-sm transition-colors ${mode === 'browser' ? 'bg-white text-black font-black' : 'text-white/80 hover:text-white'}`}>BROWSER</button>
                  </div>
                </div>
                
                <div className="hidden sm:flex items-center gap-2 opacity-80">
                    <Settings size={12} /> Use player gear icon for resolution
                </div>
            </div>

            <div className="flex flex-col lg:flex-row flex-1 overflow-hidden bg-main" ref={wrapperRef}>

                {/* LEFT: Viewport & Controls */}
                <div className="flex-1 flex flex-col bg-black relative border-b-[3px] lg:border-b-0 lg:border-r-[3px] border-border">

                    {/* The Player / Browser */}
                    <div className="flex-1 relative flex items-center justify-center">
                        {mode === 'video' ? (
                            <>
                                {loadError && (
                                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black text-white/80 text-center p-4">
                                        <p className="font-bold text-lg mb-2">Could not load video</p>
                                        <p className="text-sm opacity-70 max-w-xs">{loadError}</p>
                                    </div>
                                )}
                                <ReactPlayer
                                    ref={playerRef}
                                    src={syncedUrl}
                                    playing={playing}
                                    volume={volume}
                                    muted={muted}
                                    onTimeUpdate={(e) => { 
                                        const ct = e.target.currentTime;
                                        const dur = e.target.duration;
                                        if (!isSeeking.current && typeof ct === 'number') {
                                            if (dur > 0) setPlayedFraction(ct / dur);
                                            setPlayedSeconds(ct);
                                        }
                                    }}
                                    onDurationChange={(e) => { if (typeof e.target.duration === 'number') setDuration(e.target.duration); }}
                                    onPlay={() => setPlaying(true)}
                                    onPause={() => setPlaying(false)}
                                    onError={() => setLoadError('URL blocked by owner. Try a different YouTube link.')}
                                    width="100%"
                                    height="100%"
                                    style={{ position: 'absolute', top: 0, left: 0 }}
                                    config={{ youtube: { playerVars: { modestbranding: 1, rel: 0, controls: 1 } } }}
                                />
                            </>
                        ) : (
                            <div className="w-full h-full bg-white flex flex-col relative">
                                <div className="bg-yellow-100 text-yellow-800 p-2 text-[10px] uppercase tracking-widest font-black text-center border-b-[3px] border-yellow-300">
                                    Warning: Some sites (Netflix, Hulu) block external embedding.
                                </div>
                                <iframe src={syncedUrl} className="w-full flex-1 border-none" title="Shared Browser" sandbox="allow-scripts allow-same-origin allow-forms" />
                            </div>
                        )}

                        {/* Floating Hearts Overlay */}
                        <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
                            {hearts.map(heart => (
                                <div key={heart.id} className="absolute text-4xl text-primary animate-float-up drop-shadow-xl" style={{ left: `${heart.x}%`, top: `${heart.y}%` }}>❤️</div>
                            ))}
                        </div>
                    </div>

                    {/* Custom Retro Control Bar (Only for Video Mode) */}
                    {mode === 'video' && (
                        <div className="bg-window p-3 sm:p-4 shrink-0 flex flex-col gap-3 z-20">
                            
                            {/* Timeline Slider */}
                            <div className="flex items-center gap-3 text-main-text font-black text-[10px] tracking-widest">
                                <span className="w-10 text-right">{formatTime(playedSeconds)}</span>
                                <input 
                                    type="range" 
                                    min={0} 
                                    max={1} 
                                    step="any" 
                                    value={playedFraction} 
                                    onMouseDown={() => { isSeeking.current = true; }}
                                    onTouchStart={() => { isSeeking.current = true; }}
                                    onChange={(e) => setPlayedFraction(parseFloat(e.target.value))} 
                                    onMouseUp={handleSeekMouseUp} 
                                    onTouchEnd={handleSeekMouseUp} 
                                    className="flex-1 accent-primary h-2 bg-main retro-border rounded-full appearance-none outline-none cursor-pointer" 
                                />
                                <span className="w-10">{formatTime(duration)}</span>
                            </div>

                            {/* Media Buttons */}
                            <div className="flex justify-between items-center">
                                <div className="flex gap-2 items-center">
                                    <RetroButton onClick={handlePlayPause} className="w-10 h-10 p-0 flex items-center justify-center shadow-sm">
                                        {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
                                    </RetroButton>
                                    <RetroButton onClick={() => handleSkip(-5)} className="w-10 h-10 p-0 flex items-center justify-center shadow-sm" title="Back 5s">
                                        <RotateCcw size={16} />
                                    </RetroButton>
                                    <RetroButton onClick={() => handleSkip(5)} className="w-10 h-10 p-0 flex items-center justify-center shadow-sm" title="Forward 5s">
                                        <RotateCw size={16} />
                                    </RetroButton>
                                    
                                    <div className="hidden sm:flex items-center gap-2 ml-4 text-main-text">
                                        <button onClick={() => setMuted(!muted)} className="hover:text-primary transition-colors">
                                            {muted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                                        </button>
                                        <input type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume} onChange={(e) => {setVolume(parseFloat(e.target.value)); setMuted(false);}} className="w-24 accent-secondary h-2 bg-main retro-border rounded-full appearance-none outline-none cursor-pointer" />
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <RetroButton onClick={sendReaction} className="w-10 h-10 p-0 flex items-center justify-center text-primary border-primary hover:bg-primary hover:text-white" title="Send Love">
                                        <Heart size={18} />
                                    </RetroButton>
                                    <RetroButton onClick={toggleFullscreen} className="w-10 h-10 p-0 flex items-center justify-center shadow-sm" title="Fullscreen">
                                        <Maximize2 size={18} />
                                    </RetroButton>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* URL Loader (Always Visible) */}
                    <div className="bg-window p-3 sm:p-4 shrink-0 flex gap-2 border-t-[3px] border-border border-dashed z-20">
                        <input 
                            type="text" 
                            value={inputUrl} 
                            onChange={(e) => setInputUrl(e.target.value)} 
                            placeholder={mode === 'video' ? "Paste YouTube or MP4 link..." : "Paste website URL (https://...)"} 
                            className="flex-1 bg-main text-main-text font-bold border-[3px] border-border px-3 py-2 text-xs focus:outline-none focus:border-primary placeholder:opacity-50" 
                        />
                        <RetroButton variant="primary" onClick={handleLoadUrl} className="px-6 text-xs font-bold flex items-center gap-2 shadow-sm">
                            {mode === 'video' ? <LinkIcon size={14} /> : <Globe size={14} />} Load
                        </RetroButton>
                        <RetroButton onClick={handleInvite} className="px-6 text-xs font-bold flex items-center gap-2 bg-secondary text-secondary-text shadow-sm" title="Invite partner to watch together">
                             <Users size={14} /> Invite
                        </RetroButton>
                    </div>
                </div>

                {/* RIGHT: Live Chat Sidebar */}
                <div className="w-full lg:w-80 bg-window flex flex-col shrink-0 h-64 lg:h-auto">
                    <div className="p-3 bg-border text-window font-black uppercase tracking-widest text-[10px] flex items-center gap-2 shrink-0 shadow-sm border-b-[3px] border-border">
                        <MessageSquare size={14} /> Live Reaction Chat
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-main/50">
                        {ephemeralChat.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-center opacity-40 text-main-text">
                                <MessageSquare size={32} className="mb-2" />
                                <p className="text-[10px] font-black uppercase tracking-widest">No messages yet.<br/>Say hello!</p>
                            </div>
                        )}
                        {ephemeralChat.map((log) => (
                            <div key={log.id} className={`flex flex-col animate-in slide-in-from-bottom-2 ${log.sender === 'SYSTEM' ? 'items-center' : log.isMe ? 'items-end' : 'items-start'}`}>
                                {log.sender === 'SYSTEM' ? (
                                    <div className="bg-window px-3 py-1 retro-border text-[9px] uppercase font-black opacity-60 mt-2 tracking-widest text-main-text">
                                        {log.text}
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-1 max-w-[85%]">
                                        <span className={`text-[9px] font-black uppercase tracking-wider opacity-50 text-main-text ${log.isMe ? 'text-right' : 'text-left'}`}>{log.sender}</span>
                                        <div className={`px-3 py-2 retro-border shadow-sm text-sm font-bold ${log.isMe ? 'bg-primary text-white border-primary' : 'bg-window text-main-text'}`}>
                                            {log.text}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                        <div ref={chatEndRef} />
                    </div>

                    <form onSubmit={sendChat} className="p-3 bg-window border-t-[3px] border-border shrink-0 flex gap-2">
                        <input 
                            type="text" 
                            value={chatInput} 
                            onChange={e => setChatInput(e.target.value)} 
                            placeholder="Type a reaction..." 
                            className="flex-1 p-2 border-[3px] border-border bg-main/50 text-main-text text-xs font-bold focus:outline-none focus:border-primary" 
                        />
                        <RetroButton type="submit" variant="accent" className="px-4 text-xs font-black shadow-sm">Send</RetroButton>
                    </form>
                </div>
            </div>
        </RetroWindow>
    )
}
