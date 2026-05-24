import React, { useState, useRef, useEffect, useCallback } from 'react';
// IMPORT FIXED: No more lazy(), this guarantees the playerRef has the .seekTo() method
import ReactPlayer from 'react-player';
import { RetroWindow, RetroButton } from '../components/UI.jsx';
import { playAudio } from '../utils/audio.js';
import { 
    Play, Pause, RotateCcw, RotateCw, Heart, Link as LinkIcon, 
    MessageSquare, Volume2, VolumeX, Maximize2, Settings, Globe, 
    Users, Search, ArrowLeft, Film, Tv 
} from 'lucide-react';
import { useSync, useAuth } from '../context/instances.js';
import { useGlobalSync } from '../hooks/useSupabaseSync.js';

const PROVIDER_LABELS = {
    vidsrc: 'VS.TO',
    'vidsrc.su': 'VS.SU',
    'vidsrc.cc': 'VS.CC',
    'vidsrc.me': 'VS.ME',
    'vidsrc.xyz': 'VS.XYZ',
    multiembed: 'MULTI',
    vidlink: 'VIDLINK',
    vidking: 'VIDKING',
};

const parseEmbedUrl = (urlStr) => {
    if (!urlStr || typeof urlStr !== 'string') return null;

    try {
        const absoluteUrlStr = urlStr.startsWith('//') ? `https:${urlStr}` : urlStr;
        const url = new URL(absoluteUrlStr);
        let id = '';
        let type = 'movie';
        let season = '1';
        let episode = '1';

        if (url.hostname.includes('multiembed.mov')) {
            const videoId = url.searchParams.get('video_id');
            const s = url.searchParams.get('s');
            const e = url.searchParams.get('e');
            if (videoId) {
                id = videoId;
                if (s && e) {
                    type = 'tv';
                    season = s;
                    episode = e;
                } else {
                    type = 'movie';
                }
                return { id, type, season, episode };
            }
        }

        const pathname = url.pathname;
        const parts = pathname.split('/').filter(Boolean);

        const movieIdx = parts.indexOf('movie');
        const tvIdx = parts.indexOf('tv');

        if (movieIdx !== -1 && parts.length > movieIdx + 1) {
            id = parts[movieIdx + 1];
            type = 'movie';
            return { id, type, season, episode };
        } else if (tvIdx !== -1 && parts.length > tvIdx + 1) {
            id = parts[tvIdx + 1];
            type = 'tv';
            if (parts.length > tvIdx + 2) season = parts[tvIdx + 2];
            if (parts.length > tvIdx + 3) episode = parts[tvIdx + 3];
            return { id, type, season, episode };
        }

        const imdbMatch = pathname.match(/tt\d+/);
        if (imdbMatch) {
            id = imdbMatch[0];
            const afterImdb = parts.slice(parts.indexOf(id) + 1);
            if (afterImdb.length >= 2 && !isNaN(afterImdb[0]) && !isNaN(afterImdb[1])) {
                type = 'tv';
                season = afterImdb[0];
                episode = afterImdb[1];
            } else {
                type = 'movie';
            }
            return { id, type, season, episode };
        }

        return null;
    } catch (e) {
        return null;
    }
};

export default function SyncWatcher({ onBack, sfx, userId, onShareToChat }) {
    const { broadcast, roomProfiles } = useSync();
    const { partnerId } = useAuth();
    const partnerName = roomProfiles?.[partnerId]?.name || 'Partner';
    
    // Database Synced State (So late-joiners see the right screen)
    const [syncedUrl, setSyncedUrl] = useGlobalSync('sync_watcher_url', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    const [mode, setMode] = useGlobalSync('sync_watcher_mode', 'video');
    const [syncedTitle, setSyncedTitle] = useGlobalSync('sync_watcher_title_v2', 'YouTube/Video');
    const [watcherChat, setWatcherChat] = useGlobalSync('sync_watcher_chat_v2', []);
    
    const myName = roomProfiles?.[userId]?.name || 'You';

    // Local UI State
    const [inputUrl, setInputUrl] = useState('');
    const [localProvider, setLocalProvider] = useState(() => {
        const saved = localStorage.getItem('sync_watcher_provider_v2');
        if (!saved || saved === 'vidsrc' || saved === 'vidsrc.to') {
            return 'multiembed'; // Default to multiembed since it is sandbox-compatible and runs without errors
        }
        return saved;
    });

    const getLocalEmbedUrl = (url, provider) => {
        const info = parseEmbedUrl(url);
        if (!info) return url;

        const { id, type, season, episode } = info;

        if (type === 'movie') {
            if (provider === 'vidsrc' || provider === 'vidsrc.to') {
                return `https://vidsrc.su/embed/movie/${id}`;
            }
            if (provider === 'vidsrc.su') {
                return `https://vidsrc.su/embed/movie/${id}`;
            }
            if (provider === 'vidsrc.cc') {
                return `https://vidsrc.cc/v2/embed/movie/${id}`;
            }
            if (provider === 'vidsrc.me') {
                return `https://vidsrcme.ru/embed/movie/${id}`;
            }
            if (provider === 'vidsrc.xyz') {
                return `https://vidsrc-embed.su/embed/movie/${id}`;
            }
            if (provider === 'multiembed') {
                return `https://multiembed.mov/?video_id=${id}`;
            }
            if (provider === 'vidlink') {
                return `https://vidlink.pro/movie/${id}`;
            }
            if (provider === 'vidking') {
                return `https://www.vidking.net/embed/movie/${id}?color=e50914&autoPlay=true`;
            }
            return `https://vidsrc.su/embed/movie/${id}`;
        } else {
            if (provider === 'vidsrc' || provider === 'vidsrc.to') {
                return `https://vidsrc.su/embed/tv/${id}/${season}/${episode}`;
            }
            if (provider === 'vidsrc.su') {
                return `https://vidsrc.su/embed/tv/${id}/${season}/${episode}`;
            }
            if (provider === 'vidsrc.cc') {
                return `https://vidsrc.cc/v2/embed/tv/${id}/${season}/${episode}`;
            }
            if (provider === 'vidsrc.me') {
                return `https://vidsrcme.ru/embed/tv/${id}/${season}/${episode}`;
            }
            if (provider === 'vidsrc.xyz') {
                return `https://vidsrc-embed.su/embed/tv/${id}/${season}/${episode}`;
            }
            if (provider === 'multiembed') {
                return `https://multiembed.mov/?video_id=${id}&tmdb=0&s=${season}&e=${episode}`;
            }
            if (provider === 'vidlink') {
                return `https://vidlink.pro/tv/${id}/${season}/${episode}`;
            }
            if (provider === 'vidking') {
                return `https://www.vidking.net/embed/tv/${id}/${season}/${episode}?color=e50914&autoPlay=true&nextEpisode=true&episodeSelector=true`;
            }
            return `https://vidsrc.su/embed/tv/${id}/${season}/${episode}`;
        }
    };
    const [volume, setVolume] = useState(0.8);
    const [muted, setMuted] = useState(false);
    const [playing, setPlaying] = useState(false);
    
    // TIMELINE FIX: Separate fraction (for slider) from seconds (for text display)
    const [playedFraction, setPlayedFraction] = useState(0); 
    const [playedSeconds, setPlayedSeconds] = useState(0); 
    const [duration, setDuration] = useState(0);
    
    // Live Reaction Chat Input
    const [chatInput, setChatInput] = useState('');
    const [hearts, setHearts] = useState([]);
    const [loadError, setLoadError] = useState(null);

    // Cinema Search States
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searchFilter, setSearchFilter] = useState('all'); // all, movie, tv
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchError, setSearchError] = useState(null);
    const [selectedShow, setSelectedShow] = useState(null);
    const [seasons, setSeasons] = useState([]);
    const [selectedSeason, setSelectedSeason] = useState(1);
    const [episodes, setEpisodes] = useState([]);
    const [episodesLoading, setEpisodesLoading] = useState(false);
    const [allTVmazeEpisodes, setAllTVmazeEpisodes] = useState([]);

    const playerRef = useRef(null);
    const wrapperRef = useRef(null);
    const isSeeking = useRef(false);
    const chatEndRef = useRef(null);

    // Control Sync Refs to avoid infinite broadcast loops
    const incomingPlay = useRef(0);
    const incomingPause = useRef(0);
    const incomingSeek = useRef(0);
    const hasAnnouncedJoin = useRef(false);
    const prevPartnerActivity = useRef(null);

    const appendSystemLog = useCallback((text) => {
        const entry = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, sender: 'SYSTEM', text };
        setWatcherChat((prev) => [...(prev || []), entry]);
        broadcast('watcher_chat', entry);
    }, [setWatcherChat, broadcast]);

    const appendChatMessage = useCallback((msg) => {
        setWatcherChat((prev) => [...(prev || []), msg]);
        broadcast('watcher_chat', { ...msg, isMe: false });
    }, [setWatcherChat, broadcast]);

    const handleProviderChange = (prov) => {
        playAudio('click', sfx);
        setLocalProvider(prov);
        localStorage.setItem('sync_watcher_provider_v2', prov);
        appendSystemLog(`${myName} switched mirror to ${PROVIDER_LABELS[prov] || prov}`);
    };

    const handleModeChange = (newMode) => {
        if (newMode === mode) return;
        playAudio('click', sfx);
        setMode(newMode);
        appendSystemLog(`${myName} switched to ${newMode === 'video' ? 'Video' : 'Cinema'} mode`);
    };

    const formatTime = (sec) => {
        if (isNaN(sec) || sec === null || sec === undefined || sec === 0) return "0:00";
        const date = new Date(sec * 1000);
        const hh = date.getUTCHours();
        const mm = date.getUTCMinutes();
        const ss = date.getUTCSeconds().toString().padStart(2, '0');
        if (hh > 0) return `${hh}:${mm.toString().padStart(2, '0')}:${ss}`;
        return `${mm}:${ss}`;
    };

    useEffect(() => {
        if (hasAnnouncedJoin.current) return;
        hasAnnouncedJoin.current = true;
        appendSystemLog(`${myName} joined the watch party`);
    }, [appendSystemLog, myName]);

    useEffect(() => {
        const activity = partnerId ? roomProfiles?.[partnerId]?.activity : null;
        if (prevPartnerActivity.current !== null && activity === 'Watching SyncWatcher' && prevPartnerActivity.current !== 'Watching SyncWatcher') {
            appendSystemLog(`${partnerName} joined the watch party`);
        }
        prevPartnerActivity.current = activity;
    }, [partnerId, roomProfiles, partnerName, appendSystemLog]);

    // TMDb API Key from Vite env (Optional)
    const tmdbKey = import.meta.env.VITE_TMDB_API_KEY || '';

    // Embed URL parsing & derived state
    const parsedEmbed = parseEmbedUrl(syncedUrl);
    const isCinemaPlayerUrl = !!parsedEmbed;
    const isTvUrl = parsedEmbed?.type === 'tv';
    const currentTvId = parsedEmbed?.id || '';
    const currentSeason = parseInt(parsedEmbed?.season) || 1;
    const currentEpisode = parseInt(parsedEmbed?.episode) || 1;

    // Fallback if the user has selected a provider that requires TMDB IDs but tmdbKey is missing (so we only have IMDb IDs)
    let activeProvider = localProvider;
    if (!tmdbKey) {
        const compatibleProviders = ['vidsrc', 'vidsrc.su', 'vidsrc.cc', 'vidsrc.me', 'vidsrc.xyz', 'multiembed'];
        if (!compatibleProviders.includes(localProvider)) {
            activeProvider = 'multiembed'; // Fallback to MULTI (which is sandbox-compatible and keyless)
        }
    }

    // Auto-scroll chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [watcherChat]);



    // --- CINEMA API FETCH HELPER FUNCTIONS ---
    
    // Fallback keyless IMDb Proxy Search (with CORS enabled)
    const searchMoviesIMDb = async (query) => {
        try {
            const res = await fetch(`https://imdb.iamidiotareyoutoo.com/search?q=${encodeURIComponent(query)}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                }
            });
            const data = await res.json();
            if (data && data.ok && data.description) {
                return data.description.map(item => {
                    console.log('IMDb item type raw:', item['#IMDB_ID'], item['#TYPE']);
                    return {
                        id: item['#IMDB_ID'],
                        title: item['#TITLE'],
                        year: item['#YEAR'] || 'N/A',
                        poster: item['#IMG_POSTER'] || '',
                        type: item['#TYPE'] === 'tvSeries' || item['#TYPE'] === 'tvMiniSeries' ? 'tv' : 'movie',
                        actors: item['#ACTORS']
                    };
                });
            }
            return [];
        } catch (e) {
            console.error('IMDb Proxy error:', e);
            return [];
        }
    };

    // Fallback keyless TVmaze Search
    const searchTVmaze = async (query) => {
        try {
            const res = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`);
            const data = await res.json();
            if (data) {
                return data.map(item => ({
                    id: item.show.id,
                    title: item.show.name,
                    year: item.show.premiered ? new Date(item.show.premiered).getFullYear() : 'N/A',
                    poster: item.show.image?.medium || item.show.image?.original || '',
                    type: 'tv',
                    imdbId: item.show.externals?.imdb || '',
                    summary: item.show.summary
                }));
            }
            return [];
        } catch (e) {
            console.error('TVmaze search error:', e);
            return [];
        }
    };

    const fetchTVmazeEpisodes = async (showId) => {
        try {
            const res = await fetch(`https://api.tvmaze.com/shows/${showId}/episodes`);
            return await res.json();
        } catch (e) {
            console.error('TVmaze episodes error:', e);
            return [];
        }
    };

    // TMDb API searches (when key is available)
    const searchTMDB = async (query) => {
        try {
            const res = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${tmdbKey}&query=${encodeURIComponent(query)}`);
            const data = await res.json();
            if (data && data.results) {
                return data.results
                    .filter(item => item.media_type === 'movie' || item.media_type === 'tv')
                    .map(item => ({
                        id: item.id,
                        title: item.title || item.name,
                        year: item.release_date ? new Date(item.release_date).getFullYear() : (item.first_air_date ? new Date(item.first_air_date).getFullYear() : 'N/A'),
                        poster: item.poster_path ? `https://image.tmdb.org/t/p/w300${item.poster_path}` : '',
                        type: item.media_type,
                        overview: item.overview
                    }));
            }
            return [];
        } catch (e) {
            console.error('TMDb search error:', e);
            return [];
        }
    };

    const fetchTMDBTVDetails = async (showId) => {
        try {
            const res = await fetch(`https://api.themoviedb.org/3/tv/${showId}?api_key=${tmdbKey}`);
            return await res.json();
        } catch (e) {
            console.error('TMDb TV details error:', e);
            return null;
        }
    };

    const fetchTMDBSeasonEpisodes = async (showId, seasonNumber) => {
        try {
            const res = await fetch(`https://api.themoviedb.org/3/tv/${showId}/season/${seasonNumber}?api_key=${tmdbKey}`);
            const data = await res.json();
            return data?.episodes || [];
        } catch (e) {
            console.error('TMDb season episodes error:', e);
            return [];
        }
    };

    const resolveShowImdbId = async (show) => {
        if (show.imdbId) return show.imdbId;
        
        try {
            const res = await fetch(`https://api.tvmaze.com/shows/${show.id}`);
            if (res.ok) {
                const data = await res.json();
                if (data.externals?.imdb) {
                    return data.externals.imdb;
                }
            }
        } catch (e) {
            console.error('Error fetching TVmaze show details:', e);
        }

        try {
            const imdbResults = await searchMoviesIMDb(show.title);
            const match = imdbResults.find(m => m.title.toLowerCase() === show.title.toLowerCase());
            if (match) {
                return match.id;
            }
        } catch (e) {
            console.error('Error searching IMDb proxy by title:', e);
        }

        return null;
    };

    // --- SEARCH ACTION ---
    const handleSearch = async (query) => {
        if (!query.trim()) return;
        playAudio('click', sfx);
        setSearchLoading(true);
        setSearchError(null);
        setSelectedShow(null);
        try {
            if (tmdbKey) {
                const results = await searchTMDB(query);
                setSearchResults(results);
            } else {
                let movieResultsRaw = await searchMoviesIMDb(query);
                let tvResults = await searchTVmaze(query);
                
                const unifiedResults = [];
                const addedImdbIds = new Set();
                
                tvResults.forEach(tv => {
                    unifiedResults.push(tv);
                    if (tv.imdbId) addedImdbIds.add(tv.imdbId);
                });

                for (const item of movieResultsRaw) {
                    if (addedImdbIds.has(item.id)) {
                        continue;
                    }
                    const tvMatch = tvResults.find(tv => tv.title.toLowerCase() === item.title.toLowerCase());
                    if (tvMatch) {
                        continue;
                    }
                    unifiedResults.push(item);
                    addedImdbIds.add(item.id);
                }
                
                setSearchResults(unifiedResults);
            }
        } catch (err) {
            setSearchError('Search failed. Please verify your connection.');
        } finally {
            setSearchLoading(false);
        }
    };

    const handleSelectItem = async (item) => {
        playAudio('click', sfx);
        
        let itemType = item.type;
        let resolvedItem = { ...item };

        if (itemType === 'movie' && !tmdbKey && String(item.id).startsWith('tt')) {
            setSearchLoading(true);
            try {
                // First search TVmaze by title to avoid 404 console errors for actual movies
                const tvmazeRes = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(item.title)}`);
                if (tvmazeRes.ok) {
                    const searchData = await tvmazeRes.json();
                    const match = searchData.find(entry => entry.show?.externals?.imdb === item.id);
                    if (match && match.show) {
                        const lookupData = match.show;
                        itemType = 'tv';
                        resolvedItem = {
                            id: lookupData.id,
                            title: lookupData.name,
                            year: lookupData.premiered ? new Date(lookupData.premiered).getFullYear() : 'N/A',
                            poster: lookupData.image?.medium || lookupData.image?.original || item.poster || '',
                            type: 'tv',
                            imdbId: item.id,
                            summary: lookupData.summary
                        };
                    }
                }
            } catch (e) {
                console.error('Error in TVmaze movie/tv lookup:', e);
            } finally {
                setSearchLoading(false);
            }
        }

        if (itemType === 'movie') {
            const isImdb = String(resolvedItem.id).startsWith('tt');
            const url = isImdb 
                ? `https://vidsrc.su/embed/movie/${resolvedItem.id}`
                : `https://www.vidking.net/embed/movie/${resolvedItem.id}?color=e50914&autoPlay=true`;
            setSyncedUrl(url);
            setMode('cinema');
            appendSystemLog(`${myName} played Movie: ${resolvedItem.title}`);
        } else {
            setSelectedShow(resolvedItem);
            setEpisodesLoading(true);
            try {
                if (tmdbKey) {
                    const details = await fetchTMDBTVDetails(resolvedItem.id);
                    if (details && details.seasons) {
                        const validSeasons = details.seasons
                            .filter(s => s.season_number > 0)
                            .map(s => s.season_number);
                        setSeasons(validSeasons);
                        const firstSeason = validSeasons[0] || 1;
                        setSelectedSeason(firstSeason);
                        
                        const eps = await fetchTMDBSeasonEpisodes(resolvedItem.id, firstSeason);
                        setEpisodes(eps.map(e => ({
                            id: e.id,
                            number: e.episode_number,
                            name: e.name,
                            airdate: e.air_date
                        })));
                    }
                } else {
                    let tvmazeShowId = resolvedItem.id;
                    if (String(resolvedItem.id).startsWith('tt')) {
                        const lookupRes = await fetch(`https://api.tvmaze.com/lookup/shows?imdb=${resolvedItem.id}`);
                        if (lookupRes.ok) {
                            const lookupData = await lookupRes.json();
                            tvmazeShowId = lookupData.id;
                            setSelectedShow({
                                id: lookupData.id,
                                title: lookupData.name,
                                year: lookupData.premiered ? new Date(lookupData.premiered).getFullYear() : 'N/A',
                                poster: lookupData.image?.medium || lookupData.image?.original || resolvedItem.poster || '',
                                type: 'tv',
                                imdbId: resolvedItem.id,
                                summary: lookupData.summary
                            });
                        } else {
                            throw new Error('Show not found on TVmaze');
                        }
                    }
                    const eps = await fetchTVmazeEpisodes(tvmazeShowId);
                    const uniqueSeasons = [...new Set(eps.map(e => e.season))].sort((a, b) => a - b);
                    setSeasons(uniqueSeasons);
                    const firstSeason = uniqueSeasons[0] || 1;
                    setSelectedSeason(firstSeason);
                    setAllTVmazeEpisodes(eps);
                    setEpisodes(eps.filter(e => e.season === firstSeason).map(e => ({
                        id: e.id,
                        number: e.number,
                        name: e.name,
                        airdate: e.airdate
                    })));
                }
            } catch (e) {
                console.error(e);
            } finally {
                setEpisodesLoading(false);
            }
        }
    };

    const handleSeasonSelect = async (seasonNum) => {
        playAudio('click', sfx);
        setSelectedSeason(seasonNum);
        setEpisodesLoading(true);
        try {
            if (tmdbKey) {
                const eps = await fetchTMDBSeasonEpisodes(selectedShow.id, seasonNum);
                setEpisodes(eps.map(e => ({
                    id: e.id,
                    number: e.episode_number,
                    name: e.name,
                    airdate: e.air_date
                })));
            } else {
                setEpisodes(allTVmazeEpisodes.filter(e => e.season === seasonNum).map(e => ({
                    id: e.id,
                    number: e.number,
                    name: e.name,
                    airdate: e.airdate
                })));
            }
        } catch (e) {
            console.error(e);
        } finally {
            setEpisodesLoading(false);
        }
    };

    const handlePlayEpisode = async (episodeNumber) => {
        playAudio('click', sfx);
        
        let id = tmdbKey ? selectedShow.id : selectedShow.imdbId;
        if (!tmdbKey && !id) {
            setEpisodesLoading(true);
            id = await resolveShowImdbId(selectedShow);
            setEpisodesLoading(false);
            if (id) {
                setSelectedShow(prev => prev ? { ...prev, imdbId: id } : prev);
            }
        }

        if (!id) {
            console.error('No IMDb ID available for this show');
            setSearchError('Could not resolve IMDb ID for this series.');
            return;
        }

        const isImdb = String(id).startsWith('tt');
        const url = isImdb
            ? `https://vidsrc.su/embed/tv/${id}/${selectedSeason}/${episodeNumber}`
            : `https://www.vidking.net/embed/tv/${id}/${selectedSeason}/${episodeNumber}?color=e50914&autoPlay=true&nextEpisode=true&episodeSelector=true`;
        
        setSyncedUrl(url);
        setMode('cinema');
        appendSystemLog(`${myName} played ${selectedShow.title} - Season ${selectedSeason} Ep ${episodeNumber}`);
    };


    const handleNextPrevEpisode = (direction) => {
        playAudio('click', sfx);
        const newEp = Math.max(1, currentEpisode + direction);
        const isImdb = String(currentTvId).startsWith('tt');
        const url = isImdb
            ? `https://vidsrc.su/embed/tv/${currentTvId}/${currentSeason}/${newEp}`
            : `https://www.vidking.net/embed/tv/${currentTvId}/${currentSeason}/${newEp}?color=e50914&autoPlay=true&nextEpisode=true&episodeSelector=true`;
        setSyncedUrl(url);
        appendSystemLog(`${myName} skipped to Episode ${newEp}`);
    };

    // --- CONTROLS ---
    const handlePlayPause = () => {
        playAudio('click', sfx);
        setPlaying(!playing);
    };

    const handleSkip = (seconds) => {
        playAudio('click', sfx);
        if (playerRef.current) {
            const currentTime = playerRef.current.getCurrentTime() || 0;
            const newTime = Math.max(0, currentTime + seconds);
            playerRef.current.seekTo(newTime, 'seconds');
            setPlayedSeconds(newTime);
            appendSystemLog(`${myName} skipped to ${formatTime(newTime)}`);
        }
    };

    const handleSeekMouseUp = (e) => {
        const newFraction = parseFloat(e.target.value);
        if (playerRef.current) {
            playerRef.current.seekTo(newFraction, 'fraction');
            const seekSeconds = duration > 0 ? newFraction * duration : 0;
            appendSystemLog(`${myName} skipped to ${formatTime(seekSeconds)}`);
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
        appendSystemLog('Invite sent to partner!');
    };

    const handleUrlChange = (e) => setInputUrl(e.target.value);
    const handleLoadUrl = () => {
        if (!inputUrl) return;
        playAudio('click', sfx);
        setSyncedUrl(inputUrl.trim());
        setInputUrl('');
        setLoadError(null);
        appendSystemLog(`${myName} loaded a new URL.`);
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

    // --- LOW LATENCY SYNC PULSE ---
    useEffect(() => {
        if (!playing || isSeeking.current) return;
        
        const pulseInterval = setInterval(() => {
            if (playerRef.current) {
                const ct = playerRef.current.getCurrentTime();
                if (ct > 0) {
                    broadcast('watcher_pulse', { time: ct, timestamp: Date.now() });
                }
            }
        }, 3000); // Pulse every 3s when playing

        return () => clearInterval(pulseInterval);
    }, [playing]);

    useEffect(() => {
        const handleBroadcast = ({ detail: { event, payload } }) => {
            if (event === 'watcher_chat') {
                setWatcherChat(prev => {
                    const list = prev || [];
                    if (list.some(m => m.id === payload.id)) return list;
                    return [...list, payload];
                });
            }
            if (event === 'watcher_heart') {
                const newHeart = { id: Date.now(), x: payload.x, y: payload.y };
                setHearts(prev => [...prev, newHeart]);
                setTimeout(() => setHearts(prev => prev.filter(h => h.id !== newHeart.id)), 2000);
            }
            if (event === 'watcher_pulse' && playerRef.current && playing) {
                const ct = playerRef.current.getCurrentTime();
                const diff = Math.abs(ct - payload.time);
                // If drift is more than 1.5s, force a seek to match
                if (diff > 1.5) {
                    console.log(`[SYNC] Correcting drift of ${diff.toFixed(2)}s`);
                    incomingSeek.current += 1;
                    playerRef.current.seekTo(payload.time, 'seconds');
                }
            }
            if (event === 'watcher_control' && playerRef.current) {
                if (payload.action === 'PLAY') {
                    incomingPlay.current += 1;
                    setPlaying(true);
                }
                if (payload.action === 'PAUSE') {
                    incomingPause.current += 1;
                    setPlaying(false);
                }
                if (payload.action === 'SEEK_FRACTION') {
                    incomingSeek.current += 1;
                    playerRef.current.seekTo(payload.time, 'fraction');
                    setPlayedFraction(payload.time);
                }
                if (payload.action === 'SEEK_SECONDS') {
                    incomingSeek.current += 1;
                    playerRef.current.seekTo(payload.time, 'seconds');
                    setPlayedSeconds(payload.time);
                }
            }
        };

        window.addEventListener('sync_broadcast', handleBroadcast);
        return () => window.removeEventListener('sync_broadcast', handleBroadcast);
    }, [playing]); // need playing in deps for the pulse listener logic

    const sendChat = (e) => {
        e.preventDefault();
        if (!chatInput.trim()) return;
        playAudio('click', sfx);
        
        const msg = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, sender: myName, text: chatInput.trim(), isMe: true };
        appendChatMessage(msg);
        setChatInput('');
    };

    const toggleFullscreen = () => {
        playAudio('click', sfx);
        if (wrapperRef.current) {
            if (document.fullscreenElement) document.exitFullscreen();
            else wrapperRef.current.requestFullscreen();
        }
    };

    const filteredResults = searchResults.filter(item => {
        if (searchFilter === 'all') return true;
        return item.type === searchFilter;
    });


    return (
        <RetroWindow title={`sync_watcher.exe`} className="w-full max-w-6xl h-[calc(100dvh-4rem)] max-h-[850px] flex flex-col shadow-2xl" onClose={onBack} confirmOnClose sfx={sfx} noPadding>
            
            {/* Header Status Bar */}
            <div className="bg-border text-window p-2 flex justify-between items-center font-bold px-4 flex-shrink-0 text-[10px] uppercase tracking-widest border-b-[3px] border-border">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-2">Shared Sync <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse border border-black/50"></span> Connected</span>
                  
                  {/* VIDEO / CINEMA TOGGLE */}
                  <div className="flex bg-black/30 rounded p-0.5 retro-border shadow-inner">
                    <button onClick={() => handleModeChange('video')} className={`px-3 py-1 rounded-sm transition-colors ${mode === 'video' ? 'bg-white text-black font-black' : 'text-white/80 hover:text-white'}`}>VIDEO</button>
                    <button onClick={() => handleModeChange('cinema')} className={`px-3 py-1 rounded-sm transition-colors ${mode === 'cinema' ? 'bg-white text-black font-black' : 'text-white/80 hover:text-white'}`}>CINEMA</button>
                  </div>

                  {/* LOCAL PROVIDER SELECTOR (Only in Cinema Mode) */}
                  {mode === 'cinema' && (
                    <div className="flex bg-black/30 rounded p-0.5 retro-border shadow-inner ml-2 items-center gap-1 overflow-x-auto custom-scrollbar whitespace-nowrap">
                      <span className="text-white/40 px-1.5 py-1 text-[8px] font-black tracking-wider uppercase select-none hidden xs:inline">MIRROR:</span>
                      <button onClick={() => handleProviderChange('vidsrc')} className={`px-2 py-0.5 text-[9px] font-black rounded-sm transition-colors ${activeProvider === 'vidsrc' ? 'bg-primary text-white border-primary' : 'text-white/80 hover:text-white'}`}>VS.TO</button>
                      <button onClick={() => handleProviderChange('vidsrc.su')} className={`px-2 py-0.5 text-[9px] font-black rounded-sm transition-colors ${activeProvider === 'vidsrc.su' ? 'bg-primary text-white border-primary' : 'text-white/80 hover:text-white'}`}>VS.SU</button>
                      <button onClick={() => handleProviderChange('vidsrc.cc')} className={`px-2 py-0.5 text-[9px] font-black rounded-sm transition-colors ${activeProvider === 'vidsrc.cc' ? 'bg-primary text-white border-primary' : 'text-white/80 hover:text-white'}`}>VS.CC</button>
                      <button onClick={() => handleProviderChange('vidsrc.me')} className={`px-2 py-0.5 text-[9px] font-black rounded-sm transition-colors ${activeProvider === 'vidsrc.me' ? 'bg-primary text-white border-primary' : 'text-white/80 hover:text-white'}`}>VS.ME</button>
                      <button onClick={() => handleProviderChange('vidsrc.xyz')} className={`px-2 py-0.5 text-[9px] font-black rounded-sm transition-colors ${activeProvider === 'vidsrc.xyz' ? 'bg-primary text-white border-primary' : 'text-white/80 hover:text-white'}`}>VS.XYZ</button>
                      <button onClick={() => handleProviderChange('multiembed')} className={`px-2 py-0.5 text-[9px] font-black rounded-sm transition-colors ${activeProvider === 'multiembed' ? 'bg-primary text-white border-primary' : 'text-white/80 hover:text-white'}`}>MULTI</button>
                      {tmdbKey && (
                        <>
                          <button onClick={() => handleProviderChange('vidlink')} className={`px-2 py-0.5 text-[9px] font-black rounded-sm transition-colors ${activeProvider === 'vidlink' ? 'bg-primary text-white border-primary' : 'text-white/80 hover:text-white'}`}>VIDLINK</button>
                          <button onClick={() => handleProviderChange('vidking')} className={`px-2 py-0.5 text-[9px] font-black rounded-sm transition-colors ${activeProvider === 'vidking' ? 'bg-primary text-white border-primary' : 'text-white/80 hover:text-white'}`}>VIDKING</button>
                        </>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="hidden sm:flex items-center gap-2 opacity-80">
                    <Settings size={12} /> Use player gear icon for resolution
                </div>
            </div>

            <div className="flex flex-col lg:flex-row flex-1 overflow-hidden bg-main" ref={wrapperRef}>

                {/* LEFT: Viewport & Controls */}
                <div className="flex-1 flex flex-col bg-black relative border-b-[3px] lg:border-b-0 lg:border-r-[3px] border-border">

                    {/* The Player / Browser / Cinema */}
                    <div className="flex-1 relative flex items-center justify-center w-full h-full">
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
                                    onPlay={() => {
                                        setPlaying(true);
                                        if (incomingPlay.current > 0) {
                                            incomingPlay.current--;
                                        } else {
                                            broadcast('watcher_control', { action: 'PLAY' });
                                            appendSystemLog(`${myName} played`);
                                        }
                                    }}
                                    onPause={() => {
                                        setPlaying(false);
                                        if (incomingPause.current > 0) {
                                            incomingPause.current--;
                                        } else {
                                            broadcast('watcher_control', { action: 'PAUSE' });
                                            appendSystemLog(`${myName} paused`);
                                        }
                                    }}
                                    onSeek={(seconds) => {
                                        if (incomingSeek.current > 0) {
                                            incomingSeek.current--;
                                        } else {
                                            broadcast('watcher_control', { action: 'SEEK_SECONDS', time: seconds });
                                        }
                                    }}
                                    onError={() => setLoadError('URL blocked by owner. Try a different YouTube link.')}
                                    width="100%"
                                    height="100%"
                                    style={{ position: 'absolute', top: 0, left: 0 }}
                                    config={{ youtube: { playerVars: { modestbranding: 1, rel: 0, controls: 1 } } }}
                                />
                            </>
                        ) : (
                            /* CINEMA MODE */
                            <div className="absolute inset-0 bg-main flex flex-col overflow-hidden">
                                {isCinemaPlayerUrl ? (
                                    <>
                                        {/* Cinema Search Overlay Toggle */}
                                        <button 
                                            onClick={() => { playAudio('click', sfx); setSyncedUrl(''); }} 
                                            className="absolute top-3 left-3 z-30 px-3 py-1.5 bg-black/85 text-white font-black text-[10px] retro-border hover:bg-primary transition-colors flex items-center gap-1.5 uppercase tracking-widest shadow-lg"
                                        >
                                            <Search size={12} /> Search Cinema
                                        </button>

                                        <iframe 

                                            src={getLocalEmbedUrl(syncedUrl, activeProvider)} 
                                            className="w-full h-full border-none bg-black" 
                                            title="Cinema Player" 
                                            allowFullScreen 
                                            allow="autoplay; encrypted-media; picture-in-picture"
                                        />
                                    </>
                                ) : (
                                    /* CINEMA SEARCH INTERFACE */
                                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-6 text-main-text pb-20 custom-scrollbar">
                                        
                                        {/* Mode Header */}
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b-[3px] border-border border-dashed pb-4">
                                            <div>
                                                <h1 className="text-xl font-black uppercase tracking-wider flex items-center gap-2">
                                                    <Film size={20} className="text-primary" /> VidKing Cinema
                                                </h1>
                                                <p className="text-[10px] font-bold opacity-60 mt-1 uppercase tracking-widest">
                                                    {tmdbKey ? 'TMDb Search API Active' : 'Keyless Fallback active (Powered by TVmaze & IMDb)'}
                                                </p>
                                                <p className="text-[10px] font-bold opacity-60 mt-1 uppercase tracking-widest text-yellow-500">
                                                    Note: Content is hosted by third-party providers. If a video fails to load, try switching the Mirror above.
                                                </p>
                                            </div>
                                        </div>

                                        {selectedShow ? (
                                            /* TV SHOW DETAILS / SEASONS / EPISODES VIEW */
                                            <div className="flex flex-col gap-5 animate-in fade-in-50 duration-200">
                                                <button 
                                                    onClick={() => { playAudio('click', sfx); setSelectedShow(null); }} 
                                                    className="self-start text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 opacity-70 hover:opacity-100 transition-opacity"
                                                >
                                                    <ArrowLeft size={12} /> Back to Results
                                                </button>
                                                
                                                <div className="flex flex-col sm:flex-row gap-4 bg-window p-4 border-[3px] border-border shadow-sm">
                                                    <div className="w-24 shrink-0 aspect-[2/3] bg-black/20 retro-border overflow-hidden flex items-center justify-center">
                                                        {selectedShow.poster ? (
                                                            <img src={selectedShow.poster} alt={selectedShow.title} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <Tv size={32} className="opacity-30" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 flex flex-col gap-2">
                                                        <h2 className="text-lg font-black leading-tight">{selectedShow.title}</h2>
                                                        <p className="text-[10px] font-black text-primary uppercase tracking-widest">{selectedShow.year} • TV Show</p>
                                                        {selectedShow.summary && (
                                                            <div className="text-[11px] opacity-80 leading-relaxed font-bold max-h-24 overflow-y-auto pr-2" dangerouslySetInnerHTML={{__html: selectedShow.summary}} />
                                                        )}
                                                        {selectedShow.overview && (
                                                            <p className="text-[11px] opacity-80 leading-relaxed font-bold max-h-24 overflow-y-auto pr-2">{selectedShow.overview}</p>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Season Selector */}
                                                <div className="flex flex-col gap-2">
                                                    <label className="text-[10px] font-black uppercase tracking-widest opacity-60">Select Season</label>
                                                    <div className="flex gap-2 overflow-x-auto pb-2">
                                                        {seasons.map(sNum => (
                                                            <button 
                                                                key={sNum}
                                                                onClick={() => handleSeasonSelect(sNum)}
                                                                className={`px-4 py-1.5 font-black text-xs retro-border shrink-0 transition-colors ${selectedSeason === sNum ? 'bg-primary text-white border-primary' : 'bg-window text-main-text hover:bg-main'}`}
                                                            >
                                                                Season {sNum}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Episode Selector */}
                                                <div className="flex flex-col gap-2">
                                                    <label className="text-[10px] font-black uppercase tracking-widest opacity-60">Select Episode</label>
                                                    {episodesLoading ? (
                                                        <div className="flex items-center gap-2 py-4">
                                                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
                                                            <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Loading episodes...</span>
                                                        </div>
                                                    ) : (
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                                            {episodes.map(ep => (
                                                                <button 
                                                                    key={ep.id}
                                                                    onClick={() => handlePlayEpisode(ep.number)}
                                                                    className="bg-window hover:bg-main border-[3px] border-border hover:border-primary p-3 text-left transition-all flex flex-col gap-1.5 group shadow-sm"
                                                                >
                                                                    <div className="flex justify-between items-start w-full">
                                                                        <span className="text-[9px] font-black text-primary uppercase tracking-widest">Episode {ep.number}</span>
                                                                        {ep.airdate && <span className="text-[9px] opacity-50 font-bold">{ep.airdate}</span>}
                                                                    </div>
                                                                    <span className="text-xs font-bold text-main-text group-hover:text-primary truncate w-full">{ep.name || `Episode ${ep.number}`}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            /* SEARCH FORM & RESULTS */
                                            <div className="flex flex-col gap-4">
                                                {/* Search Bar */}
                                                <div className="flex gap-2">
                                                    <div className="relative flex-1">
                                                        <input 
                                                            type="text" 
                                                            value={searchQuery}
                                                            onChange={e => setSearchQuery(e.target.value)}
                                                            placeholder="Search Movies or TV Shows..." 
                                                            className="w-full bg-window text-main-text font-bold border-[3px] border-border px-3 py-2 pl-9 text-xs focus:outline-none focus:border-primary placeholder:opacity-50"
                                                            onKeyDown={e => e.key === 'Enter' && handleSearch(searchQuery)}
                                                        />
                                                        <Search size={14} className="absolute left-3 top-3 text-main-text opacity-50" />
                                                    </div>
                                                    <RetroButton variant="primary" onClick={() => handleSearch(searchQuery)} className="px-6 text-xs font-bold flex items-center gap-1 shadow-sm">
                                                        Search
                                                    </RetroButton>
                                                </div>

                                                {/* Filter Controls */}
                                                <div className="flex gap-2 text-[10px] uppercase font-bold tracking-wider">
                                                    <button onClick={() => { playAudio('click', sfx); setSearchFilter('all'); }} className={`px-3 py-1.5 retro-border transition-colors ${searchFilter === 'all' ? 'bg-primary text-white border-primary' : 'bg-window text-main-text hover:bg-main'}`}>All</button>
                                                    <button onClick={() => { playAudio('click', sfx); setSearchFilter('movie'); }} className={`px-3 py-1.5 retro-border transition-colors ${searchFilter === 'movie' ? 'bg-primary text-white border-primary' : 'bg-window text-main-text hover:bg-main'}`}>Movies</button>
                                                    <button onClick={() => { playAudio('click', sfx); setSearchFilter('tv'); }} className={`px-3 py-1.5 retro-border transition-colors ${searchFilter === 'tv' ? 'bg-primary text-white border-primary' : 'bg-window text-main-text hover:bg-main'}`}>TV Shows</button>
                                                </div>

                                                {/* Status Display */}
                                                {searchLoading && (
                                                    <div className="flex flex-col items-center justify-center py-16">
                                                        <div className="animate-spin rounded-full h-8 w-8 border-[3px] border-primary border-t-transparent mb-3"></div>
                                                        <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Searching Database...</p>
                                                    </div>
                                                )}

                                                {searchError && (
                                                    <div className="bg-red-900/20 text-red-500 border-[3px] border-red-900 p-3 text-xs font-bold text-center">
                                                        {searchError}
                                                    </div>
                                                )}

                                                {!searchLoading && filteredResults.length === 0 && searchQuery && (
                                                    <div className="text-center py-12 opacity-55 text-[10px] font-black uppercase tracking-widest">
                                                        No matches found. Try other keywords.
                                                    </div>
                                                )}

                                                {/* Results Grid */}
                                                {!searchLoading && filteredResults.length > 0 && (
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 animate-in fade-in-50 duration-200">
                                                        {filteredResults.map(item => (
                                                            <div 
                                                                key={`${item.type}-${item.id}`} 
                                                                onClick={() => handleSelectItem(item)}
                                                                className="bg-window border-[3px] border-border p-2 cursor-pointer hover:border-primary transition-all flex flex-col group shadow-sm hover:shadow-md"
                                                            >
                                                                <div className="aspect-[2/3] w-full bg-black/10 mb-2 relative overflow-hidden retro-border flex items-center justify-center">
                                                                    {item.poster ? (
                                                                        <img src={item.poster} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                                                    ) : (
                                                                        item.type === 'movie' ? <Film size={32} className="opacity-30" /> : <Tv size={32} className="opacity-30" />
                                                                    )}
                                                                    <span className="absolute top-1.5 right-1.5 bg-black/80 text-white font-black text-[8px] uppercase px-1.5 py-0.5 rounded tracking-widest border border-white/20">
                                                                        {item.type}
                                                                    </span>
                                                                </div>
                                                                <h3 className="font-bold text-xs truncate mb-0.5 text-main-text group-hover:text-primary transition-colors">{item.title}</h3>
                                                                <p className="text-[9px] opacity-60 font-black uppercase tracking-widest">{item.year}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Floating Hearts Overlay (Only visible during active cinema watch) */}
                                {isCinemaPlayerUrl && (
                                    <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
                                        {hearts.map(heart => (
                                            <div key={heart.id} className="absolute text-4xl text-primary animate-float-up drop-shadow-xl" style={{ left: `${heart.x}%`, top: `${heart.y}%` }}>❤️</div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Custom Retro Control Bar (Only for standard Video Mode or TV Cinema Mode skip controls) */}
                    {mode === 'video' ? (
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
                            <div className="flex justify-between items-center bg-black/5 p-2 rounded-xl border border-black/10 shadow-inner mt-2">
                                <div className="flex gap-2 sm:gap-3 items-center">
                                    <RetroButton onClick={handlePlayPause} className="w-12 h-12 p-0 flex items-center justify-center bg-primary text-white border-primary hover:scale-105 transition-all shadow-md !rounded-full" title={playing ? "Pause" : "Play"}>
                                        {playing ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" className="ml-1" />}
                                    </RetroButton>
                                    <div className="flex gap-1 bg-white/60 p-1 rounded-full border border-black/10 shadow-sm">
                                        <RetroButton onClick={() => handleSkip(-5)} className="w-10 h-10 p-0 flex items-center justify-center text-main-text hover:text-primary transition-colors !bg-transparent !border-none !shadow-none" title="Back 5s">
                                            <RotateCcw size={18} />
                                        </RetroButton>
                                        <RetroButton onClick={() => handleSkip(5)} className="w-10 h-10 p-0 flex items-center justify-center text-main-text hover:text-primary transition-colors !bg-transparent !border-none !shadow-none" title="Forward 5s">
                                            <RotateCw size={18} />
                                        </RetroButton>
                                    </div>
                                    
                                    <div className="hidden sm:flex items-center gap-2 ml-2 text-main-text bg-white/60 px-3 py-2 rounded-full border border-black/10 shadow-sm">
                                        <button onClick={() => setMuted(!muted)} className="hover:text-primary transition-colors focus:outline-none">
                                            {muted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                                        </button>
                                        <input type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume} onChange={(e) => {setVolume(parseFloat(e.target.value)); setMuted(false);}} className="w-24 accent-primary h-1.5 bg-black/20 rounded-full appearance-none outline-none cursor-pointer" />
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <RetroButton onClick={sendReaction} className="w-12 h-12 p-0 flex items-center justify-center text-pink-500 hover:bg-pink-50 transition-colors bg-white border border-pink-200 shadow-sm !rounded-full" title="Send Love">
                                        <Heart size={22} fill="currentColor" />
                                    </RetroButton>
                                    <RetroButton onClick={toggleFullscreen} className="w-12 h-12 p-0 flex items-center justify-center text-main-text hover:text-primary transition-colors bg-white border border-black/10 shadow-sm !rounded-full" title="Fullscreen">
                                        <Maximize2 size={20} />
                                    </RetroButton>
                                </div>
                            </div>
                        </div>
                    ) : (mode === 'cinema' && isTvUrl) ? (
                        /* TV Episode skipping panel in Cinema Mode */
                        <div className="bg-window p-4 shrink-0 flex items-center justify-between border-t-[3px] border-border z-20 shadow-[0_-4px_15px_rgba(0,0,0,0.05)]">
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-1.5"><Tv size={12}/> Now Playing Episode</span>
                                <span className="text-sm font-bold text-main-text">Season {currentSeason}, Episode {currentEpisode}</span>
                            </div>
                            <div className="flex gap-3">
                                <RetroButton 
                                    onClick={() => handleNextPrevEpisode(-1)} 
                                    disabled={currentEpisode <= 1} 
                                    className="px-5 py-2.5 text-sm font-black flex items-center gap-2 hover:bg-main transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed !rounded-xl"
                                    title="Previous Episode"
                                >
                                    <RotateCcw size={14} /> Previous
                                </RetroButton>
                                <RetroButton 
                                    onClick={() => handleNextPrevEpisode(1)} 
                                    className="px-5 py-2.5 text-sm font-black flex items-center gap-2 bg-primary text-white border-primary hover:scale-105 transition-all shadow-md !rounded-xl"
                                    title="Next Episode"
                                >
                                    Next Episode <RotateCw size={14} />
                                </RetroButton>
                            </div>
                        </div>
                    ) : null}

                    {/* URL Loader (Only for standard Video Mode, supports direct VidKing embed pasting) */}
                    {mode === 'video' && (
                        <div className="bg-window p-3 sm:p-4 shrink-0 flex gap-2 border-t-[3px] border-border border-dashed z-20">
                            <input 
                                type="text" 
                                value={inputUrl} 
                                onChange={(e) => setInputUrl(e.target.value)} 
                                placeholder="Paste YouTube or MP4 link..."
                                className="flex-1 bg-main text-main-text font-bold border-[3px] border-border px-3 py-2 text-xs focus:outline-none focus:border-primary placeholder:opacity-50" 
                            />
                            <RetroButton variant="primary" onClick={handleLoadUrl} className="px-6 text-xs font-bold flex items-center gap-2 shadow-sm">
                                <LinkIcon size={14} /> Load
                            </RetroButton>
                        </div>
                    )}
                </div>

                {/* RIGHT: Live Chat Sidebar */}
                <div className="w-full lg:w-80 bg-window flex flex-col shrink-0 h-64 lg:h-auto">
                    <div className="p-3 bg-border text-window font-black uppercase tracking-widest text-[10px] flex justify-between items-center shrink-0 shadow-sm border-b-[3px] border-border">
                        <span className="flex items-center gap-2">
                            <MessageSquare size={14} /> Live Reaction Chat
                        </span>
                        <RetroButton onClick={handleInvite} className="text-[9px] font-black px-2 py-1 flex items-center gap-1.5 bg-secondary text-secondary-text border-secondary active:translate-y-[1px]" title="Invite partner to watch together">
                            <Users size={10} /> Invite
                        </RetroButton>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-main/50">
                        {(watcherChat || []).length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-center opacity-40 text-main-text">
                                <MessageSquare size={32} className="mb-2" />
                                <p className="text-[10px] font-black uppercase tracking-widest">No messages yet.<br/>Say hello!</p>
                            </div>
                        )}
                        {(watcherChat || []).map((log) => (
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
    );
}
