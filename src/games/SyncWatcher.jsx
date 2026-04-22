import React, { useState, useRef, useEffect } from 'react';
import { RetroWindow, RetroButton } from '../components/UI.jsx';
import { playAudio } from '../utils/audio.js';
import ReactPlayer from 'react-player';
import { Play, Pause, FastForward, Heart, Link as LinkIcon, Users, MessageSquare, Volume2, Maximize2 } from 'lucide-react';

export function SyncWatcher({ config, onBack, sfx }) {
    const [url, setUrl] = useState('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4');
    const [inputUrl, setInputUrl] = useState('');
    const [playing, setPlaying] = useState(false);
    const [volume, setVolume] = useState(0.8);
    const [played, setPlayed] = useState(0);
    const [duration, setDuration] = useState(0);

    const [partnerConnected, setPartnerConnected] = useState(false);
    const [hearts, setHearts] = useState([]);
    const [partnerAction, setPartnerAction] = useState(null);
    const [chatLog, setChatLog] = useState([]);
    const [chatInput, setChatInput] = useState('');

    const playerRef = useRef(null);
    const wrapperRef = useRef(null);
    const [loadError, setLoadError] = useState(null);
    const [ready, setReady] = useState(false);
    const [loadingTimeout, setLoadingTimeout] = useState(false);
    const [debugOpen, setDebugOpen] = useState(false);

    useEffect(() => {
        // Mock partner connection
        const saved = (() => {
            try { return window.localStorage.getItem('sync_watcher_partner') === '1'; } catch (e) { return false; }
        })();
        if (saved) {
            setPartnerConnected(true);
        } else {
            const tm = setTimeout(() => {
                setPartnerConnected(true);
                try { window.localStorage.setItem('sync_watcher_partner', '1'); } catch (e) {}
                setChatLog(prev => [...prev, { sender: 'System', text: 'Partner joined the watch party!' }]);
                playAudio('win', sfx);
            }, 3000);
            return () => clearTimeout(tm);
        }
    }, []);

    const handlePlayPause = () => {
        const newPlay = !playing;
        setPlaying(newPlay);

        // Mock network sync message
        if (partnerConnected) {
            setPartnerAction(`You ${newPlay ? 'played' : 'paused'} the video`);
            setTimeout(() => setPartnerAction(null), 2000);
        }
    };

    const handleSeekChange = (e) => setPlayed(parseFloat(e.target.value));
    const handleSeekMouseUp = (e) => {
        if (playerRef.current) {
            playerRef.current.seekTo(parseFloat(e.target.value));
            if (partnerConnected) {
                setPartnerAction(`You scrubbed the video`);
                setTimeout(() => setPartnerAction(null), 2000);
            }
        }
    };

    const handleProgress = (state) => setPlayed(state.played);
    const handleDuration = (d) => setDuration(d);

    const handleLoadUrl = () => {
        if (!inputUrl) return;
        playAudio('click', sfx);
        // Normalize YouTube URLs to embed format to improve embedding reliability
        let newUrl = inputUrl.trim();
        try {
            let ytMatch = newUrl.match(/(?:v=|\/)([0-9A-Za-z_-]{11})(?:&|$)/);
            if (!ytMatch) {
                const short = newUrl.match(/youtu\.be\/([0-9A-Za-z_-]{11})/);
                if (short) ytMatch = short;
            }
            if (ytMatch && ytMatch[1]) {
                const id = ytMatch[1];
                // prefer embed URL
                newUrl = `https://www.youtube.com/embed/${id}`;
                console.log('SyncWatcher: transformed YouTube URL to embed', newUrl);
            }
        } catch (e) { /* ignore */ }
        setUrl(newUrl);
        try { window.localStorage.setItem('sync_watcher_url', newUrl); } catch (e) {}
        setPlaying(false);
        setPlayed(0);
        setLoadError(null);
        setReady(false);
        if (partnerConnected) {
            setChatLog(prev => [...prev, { sender: 'System', text: '-- New Video Loaded by You --' }]);
        }
    };

    const sendReaction = () => {
        playAudio('click', sfx);
        const newHeart = { id: Date.now(), x: Math.random() * 80 + 10, y: Math.random() * 20 + 70 };
        setHearts(prev => [...prev, newHeart]);
        setTimeout(() => {
            setHearts(prev => prev.filter(h => h.id !== newHeart.id));
        }, 2000);
    };

    const sendChat = (e) => {
        e.preventDefault();
        if (!chatInput.trim()) return;
        playAudio('click', sfx);
        setChatLog(prev => [...prev, { sender: 'You', text: chatInput }]);
        setChatInput('');

        // Mock partner reply
        if (partnerConnected && Math.random() > 0.5) {
            setTimeout(() => {
                const replies = ["haha yeah!", "so true", "omg", "love this part!", "😂", "agreed 100%"];
                playAudio('win', sfx); // tiny ding
                setChatLog(prev => [...prev, { sender: 'Partner', text: replies[Math.floor(Math.random() * replies.length)] }]);
            }, 2000);
        }
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

    return (
        <RetroWindow title={`sync_watcher.exe`} className="w-full max-w-5xl h-[calc(100dvh-4rem)] max-h-[800px] flex flex-col" onClose={onBack} confirmOnClose sfx={sfx} noPadding>
            <div className="bg-[var(--border)] text-[var(--bg-window)] p-2 flex justify-between items-center font-bold px-4 flex-shrink-0 text-sm sm:text-base">
                <span className="flex items-center gap-2">YouTube Sync <span className={`w-3 h-3 rounded-full ${partnerConnected ? 'bg-green-400 shadow-[0_0_8px_#4ade80]' : 'bg-red-400'} border border-black/50`}></span> {partnerConnected ? 'Connected' : 'Waiting...'}</span>
                {partnerAction && <span className="bg-white/20 px-2 py-1 rounded text-xs animate-pulse">{partnerAction}</span>}
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
                                                                onReady={() => { setReady(true); setLoadError(null); setLoadingTimeout(false); }}
                                                                onError={(e) => {
                                                                        console.error('ReactPlayer Error:', e);
                                                                        try {
                                                                            const msg = e?.message || (typeof e === 'string' ? e : JSON.stringify(e));
                                                                            setLoadError(`Could not load video: ${msg}`);
                                                                        } catch (_err) {
                                                                            setLoadError('Could not load video (unknown error).');
                                                                        }
                                                                        setLoadingTimeout(false);
                                                                }}
                                width="100%"
                                height="100%"
                                style={{ position: 'absolute', top: 0, left: 0 }}
                                config={{
                                    youtube: {
                                        playerVars: { modestbranding: 1, rel: 0, controls: 1, playsinline: 1, origin: window.location.origin }
                                    },
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

                                        {/* Loading / diagnostic overlay */}
                                        {!ready && !loadError && (
                                                <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                                                        <div className="text-white/90 text-center">
                                                                <div className="animate-pulse mb-2">Loading video…</div>
                                                                <div className="text-xs opacity-70">If this takes long, the video may not allow embedding or the URL is invalid.</div>
                                                        </div>
                                                </div>
                                        )}

                                        {loadError && (
                                                <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 text-white p-4 text-center">
                                                    <div>
                                                        <p className="font-bold text-lg mb-2">Could not load video</p>
                                                        <p className="text-sm opacity-70 mb-3">{loadError}</p>
                                                        <p className="text-xs opacity-50 mb-3">Try a direct .mp4 link, a different YouTube URL, or check browser console for details.</p>
                                                        <button onClick={() => { setLoadError(null); setReady(false); setLoadingTimeout(true); setTimeout(() => setLoadingTimeout(true), 500); }} className="px-3 py-2 retro-border bg-[var(--bg-window)] text-[var(--text-main)]">Retry</button>
                                                        <button onClick={() => setDebugOpen(!debugOpen)} className="ml-2 px-3 py-2 retro-border bg-[var(--bg-window)] text-[var(--text-main)]">Toggle Debug</button>
                                                        {debugOpen && (
                                                            <pre className="mt-3 text-xs text-left max-h-40 overflow-auto bg-black/60 p-2 rounded">{JSON.stringify({ url, ready, loadError, playerRef: !!playerRef.current }, null, 2)}</pre>
                                                        )}
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
                        <MessageSquare size={14} className="text-[var(--primary)]" /> Live Chat
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-[var(--bg-main)]">
                        {chatLog.length === 0 && <div className="text-center text-xs opacity-50 mt-4 italic">No messages yet...</div>}
                        {chatLog.map((log, i) => (
                            <div key={i} className={`flex flex-col ${log.sender === 'System' ? 'items-center' : log.sender === 'You' ? 'items-end' : 'items-start'}`}>
                                {log.sender === 'System' ? (
                                    <div className="bg-[var(--bg-window)] px-3 py-1 retro-border rounded-full text-xs font-bold opacity-70 mt-2">{log.text}</div>
                                ) : (
                                    <div className={`max-w-[85%] px-3 py-2 retro-border rounded ${log.sender === 'You' ? 'bg-[var(--primary)] text-[var(--bg-window)] shadow-sm' : 'bg-[var(--accent)] text-[var(--text-main)] shadow-sm'} text-sm font-bold`}>
                                        {log.text}
                                    </div>
                                )}
                            </div>
                        ))}
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
