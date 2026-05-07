/**
 * CallContext.jsx — Production-grade WebRTC with 100% reliability fixes:
 *
 * FIXES vs previous version:
 *  1. 'accepted' signal guard: caller-only dial via `isDialingRef` — prevents double-call
 *  2. Stale closure fix: ring timeout uses `isRingingRef` not the state value
 *  3. `recordMissedCall`: removed bogus top-level `status` column
 *  4. `recordCallEnd`: logs every completed call to chat history
 *  5. Duplicate-dial guard: `isDialingRef` prevents re-entry on retry signals
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import Peer from 'peerjs';
import { isTestMode, sendTestBroadcast, onTestBroadcast } from '../lib/testMode.js';
import { supabase } from '../lib/supabase.js';
import { useAuth } from './AuthContext.jsx';

const CallContext = createContext(null);

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'turn:openrelay.metered.ca:80',                username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443',               username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
];

function createRingTone() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    let interval;
    const ring = () => {
      const o1 = ctx.createOscillator(); const o2 = ctx.createOscillator();
      const g = ctx.createGain();
      o1.frequency.value = 480; o2.frequency.value = 620;
      o1.connect(g); o2.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.3, ctx.currentTime);
      g.gain.setValueAtTime(0, ctx.currentTime + 1);
      o1.start(); o2.start(); o1.stop(ctx.currentTime + 1); o2.stop(ctx.currentTime + 1);
    };
    ring();
    interval = setInterval(ring, 3000);
    return () => { clearInterval(interval); try { ctx.close(); } catch (_) {} };
  } catch (_) { return () => {}; }
}

export function CallProvider({ children }) {
  const { userId, partnerId, roomId } = useAuth();

  const [calling, setCalling]           = useState(null);
  const [isRinging, setIsRinging]       = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const [remoteStream, setRemoteStream] = useState(null);
  const [localStream, setLocalStream]   = useState(null);
  const [isMuted, setIsMuted]           = useState(false);
  const [isDeafened, setIsDeafened]     = useState(false);
  const [isCameraOff, setIsCameraOff]   = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callStatus, setCallStatus]     = useState('idle');
  const [callQuality, setCallQuality]   = useState('good');
  const [partnerInCall, setPartnerInCall] = useState(false);

  const peerRef           = useRef(null);
  const currentCallRef    = useRef(null);
  const dataConnRef       = useRef(null);
  const localStreamRef    = useRef(null);
  const screenTrackRef    = useRef(null);
  const callChannelRef    = useRef(null);
  const channelReadyRef   = useRef(false);
  const signalQueueRef    = useRef([]);
  const callTimerRef      = useRef(null);
  const qualityTimerRef   = useRef(null);
  const ringRetryRef      = useRef(null);
  const ringTimeoutRef    = useRef(null);
  const ringStopRef       = useRef(null);
  const callingRef        = useRef(null);
  const isRingingRef      = useRef(false); // FIX: never-stale ref for ring timeout
  const isDialingRef      = useRef(false); // FIX: prevents duplicate PeerJS dials
  const callTypeRef       = useRef(null);  // tracks call type for post-call logging
  const myPeerIdRef       = useRef(null);
  const userIdRef         = useRef(userId);

  const tabIdRef = useRef(Math.random().toString(36).substring(2, 8));
  const myPeerId = userId ? `${userId.slice(0, 8)}-${tabIdRef.current}` : null;

  // Keep refs in sync
  useEffect(() => { callingRef.current  = calling;   }, [calling]);
  useEffect(() => { myPeerIdRef.current = myPeerId;  }, [myPeerId]);
  useEffect(() => { userIdRef.current   = userId;    }, [userId]);
  useEffect(() => { isRingingRef.current = isRinging; }, [isRinging]);

  // Call Duration Timer
  useEffect(() => {
    if (calling && !isRinging) {
      setCallDuration(0);
      callTimerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
    }
    return () => { if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null; } };
  }, [calling, isRinging]);

  // cleanupCall
  const cleanupCall = useCallback(() => {
    [callTimerRef, qualityTimerRef, ringRetryRef, ringTimeoutRef].forEach(r => {
      if (r.current) { clearInterval(r.current); clearTimeout(r.current); r.current = null; }
    });
    if (ringStopRef.current) { ringStopRef.current(); ringStopRef.current = null; }
    if (screenTrackRef.current) { try { screenTrackRef.current.stop(); } catch(_){} screenTrackRef.current = null; }
    if (localStreamRef.current) { localStreamRef.current.getTracks().forEach(t => t.stop()); localStreamRef.current = null; }
    if (currentCallRef.current) { try { currentCallRef.current.close(); } catch(_){} currentCallRef.current = null; }
    isDialingRef.current = false;

    setCalling(null); setIsRinging(false); setIncomingCall(null);
    setRemoteStream(null); setLocalStream(null); setCallDuration(0);
    setIsMuted(false); setIsCameraOff(false); setIsScreenSharing(false);
    setCallStatus('idle'); setCallQuality('good');
  }, []);

  // Quality Monitor
  const startQualityMonitor = useCallback(() => {
    if (qualityTimerRef.current) clearInterval(qualityTimerRef.current);
    qualityTimerRef.current = setInterval(async () => {
      const pc = currentCallRef.current?.peerConnection;
      if (!pc) return;
      try {
        const stats = await pc.getStats();
        stats.forEach(r => {
          if (r.type === 'inbound-rtp' && r.kind === 'audio' && r.packetsReceived > 0) {
            const loss = (r.packetsLost || 0) / (r.packetsReceived + (r.packetsLost || 0));
            const quality = loss < 0.02 ? 'good' : loss < 0.08 ? 'fair' : 'poor';
            setCallQuality(quality);
            const sender = pc.getSenders().find(s => s.track?.kind === 'audio');
            if (sender) {
              const params = sender.getParameters();
              if (params.encodings?.length) {
                params.encodings[0].maxBitrate = quality === 'poor' ? 16000 : quality === 'fair' ? 32000 : 64000;
                sender.setParameters(params).catch(() => {});
              }
            }
          }
        });
      } catch (_) {}
    }, 4000);
  }, []);

  // sendSignal with queue
  const sendSignal = useCallback((payload) => {
    console.log('[Call] →', payload.action, payload);
    if (channelReadyRef.current && callChannelRef.current) {
      callChannelRef.current.send({ type: 'broadcast', event: 'call_signal', payload });
    } else {
      signalQueueRef.current.push(payload);
    }
    if (isTestMode()) sendTestBroadcast('call_signal', payload);
  }, []);

  const flushSignalQueue = useCallback(() => {
    const q = signalQueueRef.current.splice(0);
    q.forEach(payload => callChannelRef.current?.send({ type: 'broadcast', event: 'call_signal', payload }));
  }, []);

  // FIX: recordMissedCall — no bogus top-level `status` column
  const recordMissedCall = useCallback((type) => {
    if (!roomId || !userId) return;
    supabase.from('chat_messages').insert({
      room_id: roomId, sender_id: userId,
      type: 'call_invite',
      content: `${type === 'video' ? 'Video' : 'Voice'} Call (Missed)`,
      metadata: { callType: type || 'audio', status: 'missed' },
    }).then(({ error }) => { if (error) console.warn('[Call] Missed call log failed:', error.message); });
  }, [roomId, userId]);

  // NEW: recordCallEnd — logs a completed call to chat history
  const recordCallEnd = useCallback((type, duration) => {
    if (!roomId || !userId) return;
    const mins = Math.floor(duration / 60);
    const secs = duration % 60;
    const durationStr = `${mins}:${secs.toString().padStart(2, '0')}`;
    supabase.from('chat_messages').insert({
      room_id: roomId, sender_id: userId,
      type: 'call_invite',
      content: `${type === 'video' ? 'Video' : 'Voice'} Call · ${durationStr}`,
      metadata: { callType: type || 'audio', status: 'ended', duration: durationStr },
    }).then(({ error }) => { if (error) console.warn('[Call] Call end log failed:', error.message); });
  }, [roomId, userId]);

  // ICE state handler
  const attachIceHandlers = useCallback((call) => {
    const pc = call.peerConnection;
    if (!pc) return;
    pc.oniceconnectionstatechange = () => {
      const s = pc.iceConnectionState;
      console.log('[Call] ICE state:', s);
      if (s === 'disconnected' || s === 'failed') {
        setCallStatus('reconnecting');
        if (s === 'failed') { try { pc.restartIce(); } catch(_){} }
      } else if (s === 'connected' || s === 'completed') {
        setCallStatus('connected');
        startQualityMonitor();
      }
    };
  }, [startQualityMonitor]);

  // handleSignal
  const handleSignal = useCallback((payload) => {
    const self = myPeerIdRef.current;
    console.log('[Call] ←', payload.action, '| self:', self);

    switch (payload.action) {

      case 'ring': {
        if (payload.callerPeerId === self) return; // I sent this, ignore
        if (callingRef.current) {
          sendSignal({ action: 'busy', to: payload.callerPeerId });
          return;
        }
        setIncomingCall({ type: payload.type, callerPeerId: payload.callerPeerId, fromName: payload.fromName });
        setIsRinging(true);
        if (ringStopRef.current) ringStopRef.current();
        ringStopRef.current = createRingTone();
        break;
      }

      case 'busy': {
        if (payload.to && payload.to !== self) return;
        cleanupCall();
        window.dispatchEvent(new CustomEvent('call_busy'));
        break;
      }

      case 'accepted': {
        // FIX: Only the CALLER should dial.
        // We are the caller if: we are currently ringing outbound (callingRef.current is set)
        // AND our peer ID is NOT the receiverPeerId in the payload.
        // Without this guard, the receiver also tries to dial back → double PeerJS call.
        if (!callingRef.current || payload.receiverPeerId === self) return;

        // FIX: Prevent duplicate dials from ring retry signals
        if (isDialingRef.current) {
          console.log('[Call] Already dialing, ignoring duplicate accepted signal');
          return;
        }
        isDialingRef.current = true;

        console.log('[Call] Accepted by', payload.receiverPeerId, '— initiating PeerJS call');
        if (ringStopRef.current) { ringStopRef.current(); ringStopRef.current = null; }
        if (ringRetryRef.current) { clearInterval(ringRetryRef.current); ringRetryRef.current = null; }
        if (ringTimeoutRef.current) { clearTimeout(ringTimeoutRef.current); ringTimeoutRef.current = null; }
        setIsRinging(false);
        setCallStatus('connecting');

        const peer   = peerRef.current;
        const stream = localStreamRef.current;
        if (!peer?.destroyed && stream) {
          const call = peer.call(payload.receiverPeerId, stream, { metadata: { type: payload.type } });
          currentCallRef.current = call;
          attachIceHandlers(call);
          call.on('stream', (rs) => {
            setRemoteStream(rs);
            setCalling(payload.type || 'audio');
            callTypeRef.current = payload.type || 'audio';
            setCallStatus('connected');
          });
          call.on('close',  () => cleanupCall());
          call.on('error',  () => cleanupCall());
        } else {
          isDialingRef.current = false;
          cleanupCall();
        }
        break;
      }

      case 'ended': {
        cleanupCall();
        break;
      }

      case 'upgrade': {
        setCalling('video'); setIsCameraOff(false);
        break;
      }

      default: break;
    }
  }, [cleanupCall, sendSignal, attachIceHandlers]);

  // Initialize PeerJS
  useEffect(() => {
    if (!userId || !myPeerId) return;
    let mounted = true, retryCount = 0, retryTimeout = null;

    const initPeer = () => {
      if (peerRef.current && !peerRef.current.destroyed) peerRef.current.destroy();
      console.log('[Call] Initializing peer:', myPeerId);
      const peer = new Peer(myPeerId, { debug: 1, config: { iceServers: ICE_SERVERS } });
      peerRef.current = peer;

      peer.on('open', (id) => { console.log('[Call] ✅ Peer open:', id); retryCount = 0; });
      peer.on('disconnected', () => { if (mounted && !peer.destroyed) peer.reconnect(); });
      peer.on('connection', (conn) => {
        dataConnRef.current = conn;
        conn.on('data',  d => window.dispatchEvent(new CustomEvent('webrtc_data', { detail: d })));
        conn.on('close', () => { dataConnRef.current = null; });
      });

      // RECEIVER: answer incoming PeerJS call
      peer.on('call', async (call) => {
        console.log('[Call] Incoming PeerJS call from', call.peer);
        currentCallRef.current = call;
        attachIceHandlers(call);

        call.on('stream', (rs) => {
          setRemoteStream(rs);
          const t = call.metadata?.type || 'audio';
          setCalling(t);
          callTypeRef.current = t;
          setIsRinging(false);
          setCallStatus('connected');
        });
        call.on('close',  () => cleanupCall());
        call.on('error',  () => cleanupCall());

        let stream = localStreamRef.current;
        if (!stream) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: call.metadata?.type === 'video' });
            localStreamRef.current = stream; setLocalStream(stream);
          } catch (e) { console.error('[Call] Cannot get media:', e); call.close(); return; }
        }
        call.answer(stream);
      });

      peer.on('error', (err) => {
        console.error('[Call] Peer error:', err.type);
        const retriable = ['network','server-error','socket-error','socket-closed','unavailable-id'];
        if (retriable.includes(err.type) && mounted && retryCount < 6) {
          retryCount++;
          const delay = Math.min(2000 * retryCount, 12000);
          console.warn(`[Call] Retrying peer in ${delay}ms (attempt ${retryCount})`);
          retryTimeout = setTimeout(initPeer, delay);
        }
      });
    };

    initPeer();

    const onOnline = () => {
      console.log('[Call] Network restored');
      const pc = currentCallRef.current?.peerConnection;
      if (pc) { try { pc.restartIce(); } catch(_){} }
      // Also reinit peer if destroyed
      if (!peerRef.current || peerRef.current.destroyed) initPeer();
    };
    window.addEventListener('online', onOnline);

    return () => {
      mounted = false;
      window.removeEventListener('online', onOnline);
      if (retryTimeout) clearTimeout(retryTimeout);
      const p = peerRef.current; peerRef.current = null;
      if (p && !p.destroyed) p.destroy();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, myPeerId]);

  // Supabase Signaling Channel
  useEffect(() => {
    if (!roomId || !userId) return;
    const channelId = `room_call_${roomId}`;
    const channel = supabase.channel(channelId, { config: { broadcast: { self: false } } });
    callChannelRef.current = channel; channelReadyRef.current = false;

    channel
      .on('broadcast', { event: 'call_signal' }, ({ payload }) => handleSignal(payload))
      .on('presence',  { event: 'sync' }, () => {
        const state = channel.presenceState();
        const partnerPresence = Object.values(state).flat().find(p => p.userId !== userId);
        setPartnerInCall(partnerPresence?.status === 'in_call');
      })
      .subscribe(async (status) => {
        console.log('[Call] Channel', channelId, ':', status);
        if (status === 'SUBSCRIBED') {
          channelReadyRef.current = true;
          flushSignalQueue();
          await channel.track({ userId, status: callingRef.current ? 'in_call' : 'online' });
        } else {
          channelReadyRef.current = false;
        }
      });

    return () => { channelReadyRef.current = false; channel.unsubscribe(); callChannelRef.current = null; };
  }, [roomId, userId, handleSignal, flushSignalQueue]);

  // Update presence when call state changes
  useEffect(() => {
    if (channelReadyRef.current && callChannelRef.current) {
      callChannelRef.current.track({ userId, status: calling ? 'in_call' : 'online' }).catch(() => {});
    }
  }, [calling, userId]);

  // Test mode
  useEffect(() => {
    if (!isTestMode()) return;
    return onTestBroadcast('call_signal', handleSignal);
  }, [handleSignal]);

  useEffect(() => {
    const h = ({ detail: { event, payload } }) => { if (event === 'call_signal') handleSignal(payload); };
    window.addEventListener('sync_broadcast', h);
    return () => window.removeEventListener('sync_broadcast', h);
  }, [handleSignal]);

  // ── Public API ──────────────────────────────────────────────────────────────

  const startCall = useCallback(async (type) => {
    if (!partnerId || !myPeerId) return;
    if (partnerInCall) { alert(`Partner is already on another call.`); return; }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === 'video' });
      localStreamRef.current = stream;
      callTypeRef.current = type;
      setLocalStream(stream); setCalling(type); setIsRinging(true);
      setIsCameraOff(type === 'audio'); setCallStatus('connecting');
      isDialingRef.current = false; // reset for this new call

      const payload = { action: 'ring', callerPeerId: myPeerId, type, fromName: userIdRef.current };
      sendSignal(payload);

      if (ringStopRef.current) ringStopRef.current();
      ringStopRef.current = createRingTone();

      // Retry ring every 4s
      ringRetryRef.current = setInterval(() => sendSignal(payload), 4000);

      // FIX: Use isRingingRef (not stale `isRinging` state) for the 30s timeout
      ringTimeoutRef.current = setTimeout(() => {
        if (isRingingRef.current) {
          recordMissedCall(type);
          cleanupCall();
        }
      }, 30000);

    } catch (e) {
      console.error('[Call] startCall failed:', e);
      cleanupCall();
      alert('Could not access microphone/camera. Please check browser permissions.');
    }
  }, [partnerId, myPeerId, partnerInCall, sendSignal, cleanupCall, recordMissedCall]);

  const acceptCall = useCallback(async () => {
    const incoming = incomingCall;
    if (!incoming) return;
    if (ringStopRef.current) { ringStopRef.current(); ringStopRef.current = null; }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: incoming.type === 'video' });
      localStreamRef.current = stream;
      callTypeRef.current = incoming.type;
      setLocalStream(stream); setCalling(incoming.type); setIsRinging(false);
      setIncomingCall(null); setIsCameraOff(incoming.type === 'audio'); setCallStatus('connecting');

      sendSignal({ action: 'accepted', receiverPeerId: myPeerIdRef.current, type: incoming.type });
    } catch (err) {
      console.error('[Call] acceptCall failed:', err);
      cleanupCall();
    }
  }, [incomingCall, sendSignal, cleanupCall]);

  const declineCall = useCallback(() => {
    if (ringStopRef.current) { ringStopRef.current(); ringStopRef.current = null; }
    sendSignal({ action: 'ended' });
    setIncomingCall(null); setIsRinging(false);
  }, [sendSignal]);

  // FIX: endCall now records call end to chat history
  const endCall = useCallback(() => {
    const type = callTypeRef.current;
    const duration = callTimerRef.current ? callDuration : 0;
    // Only log if the call was actually connected (not just ringing)
    if (type && callingRef.current && !isRingingRef.current) {
      recordCallEnd(type, duration);
    }
    sendSignal({ action: 'ended' });
    cleanupCall();
  }, [sendSignal, cleanupCall, recordCallEnd, callDuration]);

  const toggleMic = useCallback(() => {
    setIsMuted(prev => {
      const muted = !prev;
      localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !muted; });
      return muted;
    });
  }, []);

  const toggleDeafen = useCallback(() => setIsDeafened(p => !p), []);

  const toggleCamera = useCallback(async () => {
    const wasOff = isCameraOff;
    setIsCameraOff(!wasOff);
    if (wasOff) {
      if (callingRef.current === 'audio') {
        setCalling('video'); sendSignal({ action: 'upgrade', type: 'video' });
        try {
          const vs = await navigator.mediaDevices.getUserMedia({ video: true });
          const vt = vs.getVideoTracks()[0];
          if (vt && localStreamRef.current) {
            localStreamRef.current.addTrack(vt);
            const pc = currentCallRef.current?.peerConnection;
            if (pc) {
              const existing = pc.getSenders().find(s => s.track?.kind === 'video');
              if (existing) existing.replaceTrack(vt); else pc.addTrack(vt, localStreamRef.current);
            }
          }
        } catch (e) { console.error('[Call] Camera toggle failed:', e); setIsCameraOff(true); setCalling('audio'); }
      } else {
        localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = true; });
      }
    } else {
      localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = false; });
    }
  }, [isCameraOff, sendSignal]);

  const startScreenShare = useCallback(async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const screenTrack = screenStream.getVideoTracks()[0];
      screenTrackRef.current = screenTrack;
      const pc = currentCallRef.current?.peerConnection;
      if (pc) {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(screenTrack); else pc.addTrack(screenTrack, localStreamRef.current);
      }
      setIsScreenSharing(true); setCalling('video');
      sendSignal({ action: 'upgrade', type: 'video' });
      screenTrack.onended = () => stopScreenShare();
    } catch (e) { console.error('[Call] Screen share failed:', e); }
  }, [sendSignal]);

  const stopScreenShare = useCallback(async () => {
    if (screenTrackRef.current) { screenTrackRef.current.stop(); screenTrackRef.current = null; }
    setIsScreenSharing(false);
    try {
      const vs = await navigator.mediaDevices.getUserMedia({ video: true });
      const vt = vs.getVideoTracks()[0];
      const pc = currentCallRef.current?.peerConnection;
      if (pc && vt) { const sender = pc.getSenders().find(s => s.track?.kind === 'video'); if (sender) sender.replaceTrack(vt); }
    } catch (_) {}
  }, []);

  const sendData = useCallback((data) => {
    if (dataConnRef.current?.open) { dataConnRef.current.send(data); return true; }
    return false;
  }, []);

  const value = {
    calling, isRinging, incomingCall, callDuration, callStatus, callQuality,
    remoteStream, localStream, isMuted, isDeafened, isCameraOff, isScreenSharing,
    partnerInCall, myPeerId,
    startCall, acceptCall, declineCall, endCall,
    toggleMic, toggleCamera, toggleDeafen,
    startScreenShare, stopScreenShare, sendData,
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used within a CallProvider');
  return ctx;
}
