import React, { useState, useRef, useEffect } from 'react';
import { RetroWindow, RetroButton } from '../components/UI.jsx';
import { playAudio } from '../utils/audio.js';
import ReactPlayer from 'react-player';
import { Play, Pause, FastForward, Heart, Link as LinkIcon, Users, MessageSquare, Volume2, Maximize2 } from 'lucide-react';
import { useGlobalSync } from '../hooks/useSupabaseSync.js';

export function SyncWatcher({ config, onBack, sfx, userId }) {
    // 1. Synced Global State
    const [url, setUrl] = useGlobalSync('sync_watcher_url', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4');
    const [playing, setPlaying] = useGlobalSync('sync_watcher_playing', false);
    const [syncedPlayed, setSyncedPlayed] = useGlobalSync('sync_watcher_played', 0);
    const [chatLog, setChatLog] = useGlobalSync('sync_watcher_chat', []);
    const [lastAction, setLastAction] = useGlobalSync('sync_watcher_last_action', { type: 'init', actor: 'system', timestamp: Date.now() });

    // 2. Local UI State
    const [inputUrl, setInputUrl] = useState('');
    const [volume, setVolume] = useState(0.8);
    const [played, setPlayed] = useState(0); // Local slider position
    const [duration, setDuration] = useState(0);
    const [hearts, setHearts] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [loadError, setLoadError] = useState(null);
    const [ready, setReady] = useState(false);
    const [debugOpen, setDebugOpen] = useState(false);

    const playerRef = useRef(null);
    const wrapperRef = useRef(null);
    const isSeeking = useRef(false);

    // 3. Sync Logic: React to partner's changes
    useEffect(() => {
        // When url or playing changes from global state, it's already handled by React's rendering
        // But we need to handle seeking manually to avoid loops
        if (Math.abs(syncedPlayed - played) > 0.05 && !isSeeking.current) {
            console.log('[SYNC] Partner seek detected, adjusting local player to:', syncedPlayed);
            playerRef.current?.seekTo(syncedPlayed);
            setPlayed(syncedPlayed);
        }
    }, [syncedPlayed]);

    const handlePlayPause = () => {
        const newPlay = !playing;
        playAudio('click', sfx);
        setPlaying(newPlay);
        setLastAction({ type: newPlay ? 'play' : 'pause', actor: 'user', timestamp: Date.now() });
    };

    const handleSeekChange = (e) => {
        isSeeking.current = true;
        setPlayed(parseFloat(e.target.value));
    };

    const handleSeekMouseUp = (e) => {
        const newTime = parseFloat(e.target.value);
        if (playerRef.current) {
            playerRef.current.seekTo(newTime);
            setSyncedPlayed(newTime);
            setLastAction({ type: 'seek', actor: 'user', timestamp: Date.now() });
        }
        isSeeking.current = false;
    };

    const handleProgress = (state) => {
        // Only update local slider if not seeking
        if (!isSeeking.current) {
            setPlayed(state.played);
            
            // Periodically sync the time (every 5 seconds) to keep users in sync if one drifts
            if (Math.floor(state.playedSeconds) % 5 === 0 && Math.abs(state.played - syncedPlayed) > 0.01) {
                // To avoid "fighting" over the time, we only sync if we are the one playing?
                // Or just let the most recent update win. 
                // For simplicity, we don't auto-sync progress here to avoid jitter.
            }
        }
    };

    const handleDuration = (d) => setDuration(d);

    const handleLoadUrl = () => {
        if (!inputUrl) return;
        playAudio('click', sfx);
        const newUrl = inputUrl.trim();
        console.log('[SYNC] Broadcasting new URL:', newUrl);
        
        setUrl(newUrl);
        setPlaying(false);
        setSyncedPlayed(0);
        setPlayed(0);
        setLoadError(null);
        setReady(false);
        setChatLog(prev => [...prev, { sender: 'System', text: `-- New Video Loaded --` }]);
        setLastAction({ type: 'load', actor: 'user', timestamp: Date.now() });
    };

    const sendReaction = () => {
        playAudio('click', sfx);
        const newHeart = { id: Date.now(), x: Math.random() * 80 + 10, y: Math.random() * 20 + 70 };
        setHearts(prev => [...prev, newHeart]);
        setTimeout(() => {
            setHearts(prev => prev.filter(h => h.id !== newHeart.id));
        }, 2000);
        // We could sync hearts too, but it might be too much traffic
    };

    const sendChat = (e) => {
        e.preventDefault();
        if (!chatInput.trim()) return;
        playAudio('click', sfx);
        
        const newMessage = { 
            senderId: userId, 
            sender: 'User', // Local perspective
            text: chatInput, 
            timestamp: Date.now(), 
            id: Date.now() 
        };
        
        setChatLog(prev => [...prev, newMessage]);
        setChatInput('');
    };

    const toggleFullscreen = () => {
        if (wrapperRef.current) {
            if (document.fullscreenElement) document.exitFullscreen();
            else wrapperRef.current.requestFullscreen();
        }
    };

    const formatTime = (seconds) => {
        const g = (v) => v < 10 ? '0' + v : v;
        return `${Math.floor(seconds / 60)}:${g(Math.floor(seconds % 60))}`;
    };

    const displayAction = () => {
        if (!lastAction || Date.now() - lastAction.timestamp > 3000) return null;
        if (lastAction.type === 'play') return 'Video Playing';
        if (lastAction.type === 'pause') return 'Video Paused';
        if (lastAction.type === 'seek') return 'Seeking...';
        if (lastAction.type === 'load') return 'New Video Loaded';
        return null;
    };

    return (
        <RetroWindow title={`sync_watcher.exe`} className="w-full max-w-5xl h-[calc(100dvh-4rem)] max-h-[800px] flex flex-col" onClose={onBack} confirmOnClose sfx={sfx} noPadding>
            <div className="bg-[var(--border)] text-[var(--bg-window)] p-2 flex justify-between items-center font-bold px-4 flex-shrink-0 text-sm sm:text-base">
                <span className="flex items-center gap-2">Shared Sync <span className={`w-3 h-3 rounded-full bg-green-400 shadow-[0_0_8px_#4ade80] border border-black/50`}></span> Connected</span>
                {displayAction() && <span className="bg-white/20 px-2 py-1 rounded text-xs animate-pulse">{displayAction()}</span>}
            </div>

            <div className="flex flex-col lg:flex-row flex-1 overflow-hidden" ref={wrapperRef}>

                <div className="flex-1 flex flex-col bg-black relative overflow-hidden retro-border-r">

                    <div className="flex-1 relative flex items-center justify-center">
                        <div className="absolute inset-0 z-0">
                            {loadError && (
                                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black text-white/80 text-center p-4">
                                    <p className="font-bold text-lg mb-2">Could not load video</p>
                                    <p className="text-sm opacity-70 max-w-xs">{loadError}</p>
                                    <p className="text-xs opacity-50 mt-4">Try pasting a direct .mp4 link or a different YouTube URL</p>
                                </div>
                            )}
                            <ReactPlayer
                                ref={playerRef}
                                url={url}
                                playing={playing}
                                volume={volume}
                                onProgress={handleProgress}
                                onDuration={handleDuration}
                                onReady={() => { 
                                    console.log('[SYNC] Player is READY');
                                    setReady(true); 
                                    setLoadError(null); 
                                }}
                                onError={(e) => {
                                    console.error('[SYNC] Player Error:', e);
                                    setLoadError('Could not load video. Check URL or embedding permissions.');
                                }}
                                width="100%"
                                height="100%"
                                style={{ position: 'absolute', top: 0, left: 0 }}
                                config={{
                                    youtube: { playerVars: { modestbranding: 1, rel: 0, controls: 1, playsinline: 1 } },
                                    file: { attributes: { controls: true, playsInline: true } }
                                }}
                            />
                        </div>

                        {/* Reactions Overlay */}
                        <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
                            {hearts.map(heart => (
                                <div key={heart.id} className="absolute text-3xl sm:text-4xl text-red-500 animate-float-up drop-shadow-lg" style={{ left: `${heart.x}%`, top: `${heart.y}%` }}>
                                    ❤️
                                </div>
                            ))}
                        </div>
                    </div>

                    {!ready && !loadError && (
                        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none bg-black/40">
                            <div className="text-white/90 text-center">
                                <div className="animate-pulse mb-2 font-bold uppercase tracking-widest text-xs">Syncing stream...</div>
                                <div className="w-48 h-1 bg-white/20 mx-auto rounded-full overflow-hidden">
                                    <div className="h-full bg-[var(--primary)] animate-progress-indefinite"></div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="bg-[var(--bg-window)] border-t border-[var(--border)] p-2 sm:p-4 shrink-0 flex flex-col gap-2 z-20">

                        <div className="flex items-center gap-2 text-[var(--text-main)] opacity-80 font-mono text-xs font-bold">
                            <span>{formatTime(played * duration)}</span>
                            <input type="range" min={0} max={1} step="any" value={played} onChange={handleSeekChange} onMouseUp={handleSeekMouseUp} onTouchEnd={handleSeekMouseUp} className="flex-1 accent-[var(--primary)] h-2 bg-[var(--bg-main)] retro-border rounded-full appearance-none outline-none cursor-pointer" />
                            <span>{formatTime(duration)}</span>
                        </div>

                        <div className="flex justify-between items-center mt-1">
                            <div className="flex gap-2">
                                <button onClick={handlePlayPause} className="w-10 h-10 bg-[var(--bg-main)] hover:bg-[var(--accent)] retro-border rounded flex items-center justify-center text-[var(--text-main)] transition-colors">{playing ? <Pause size={20} /> : <Play size={20} className="ml-1" />}</button>
                                <button onClick={() => playerRef.current?.seekTo(parseFloat(played) + 0.05)} className="w-10 h-10 bg-[var(--bg-main)] hover:bg-[var(--accent)] retro-border rounded flex items-center justify-center text-[var(--text-main)] transition-colors"><FastForward size={20} /></button>
                                <div className="flex items-center gap-2 ml-4 text-[var(--text-main)] hidden sm:flex">
                                    <Volume2 size={16} />
                                    <input type="range" min={0} max={1} step={0.1} value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))} className="w-20 accent-[var(--secondary)]" />
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <button onClick={sendReaction} className="w-10 h-10 bg-[var(--bg-main)] hover:bg-[var(--accent)] retro-border rounded flex items-center justify-center text-red-500 transition-colors"><Heart size={20} /></button>
                                <button onClick={toggleFullscreen} className="w-10 h-10 bg-[var(--bg-main)] hover:bg-[var(--accent)] retro-border rounded flex items-center justify-center text-[var(--text-main)] transition-colors"><Maximize2 size={20} /></button>
                            </div>
                        </div>

                        <div className="flex gap-2 mt-2 pt-2 border-t border-[var(--border)] border-dashed">
                            <input type="text" value={inputUrl} onChange={(e) => setInputUrl(e.target.value)} placeholder="Paste Youtube or MP4 URL here..." className="flex-1 bg-white text-black font-bold border border-[var(--border)] rounded px-3 py-2 text-sm focus:outline-none focus:border-[var(--primary)]" />
                            <button onClick={handleLoadUrl} className="bg-[var(--primary)] text-[var(--bg-window)] px-4 py-2 rounded text-sm font-bold flex items-center gap-2 retro-border transition-transform active:scale-95"><LinkIcon size={14} /> Load</button>
                        </div>
                    </div>
                </div>

                <div className="w-full lg:w-80 bg-[var(--bg-main)] retro-border-l flex flex-col shrink-0 h-64 lg:h-auto">
                    <div className="p-3 bg-[var(--bg-window)] border-b border-black/10 font-bold uppercase tracking-widest text-xs flex items-center gap-2 shrink-0">
                        <MessageSquare size={14} className="text-[var(--primary)]" /> Watch Chat
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-[var(--bg-main)]">
                        {chatLog.length === 0 && <div className="text-center text-xs opacity-50 mt-4 italic">No messages yet...</div>}
                        {chatLog.map((log, i) => {
                            const isMe = log.senderId === userId || log.sender === 'User';
                            return (
                                <div key={log.id || i} className={`flex flex-col ${log.sender === 'System' ? 'items-center' : isMe ? 'items-end' : 'items-start'}`}>
                                    {log.sender === 'System' ? (
                                        <div className="bg-[var(--bg-window)] px-3 py-1 retro-border rounded-full text-xs font-bold opacity-70 mt-2">{log.text}</div>
                                    ) : (
                                        <div className={`max-w-[85%] px-3 py-2 retro-border rounded ${isMe ? 'bg-[var(--primary)] text-[var(--bg-window)] shadow-sm' : 'bg-[var(--accent)] text-[var(--text-main)] shadow-sm'} text-sm font-bold`}>
                                            {log.text}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <form onSubmit={sendChat} className="p-3 bg-[var(--bg-window)] retro-border-t shrink-0 flex gap-2">
                        <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Say something..." className="flex-1 p-2 retro-border text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" />
                        <RetroButton type="submit" variant="accent" className="px-4 text-sm font-bold">Send</RetroButton>
                    </form>
                </div>

            </div>
        </RetroWindow>
    )
}
