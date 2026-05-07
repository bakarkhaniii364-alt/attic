/**
 * CallContext.jsx — Production-grade WebRTC (Messenger/WhatsApp parity)
 *
 * Features:
 *  1. TURN servers (Open Relay — free, no signup)
 *  2. Ring retry every 4s, auto-timeout at 30s
 *  3. Missed call tracking via chat message
 *  4. ICE restart on network reconnect
 *  5. Connection quality via RTCStats API
 *  6. Adaptive audio bitrate based on quality
 *  7. "Reconnecting..." state on ICE failure
 *  8. "Already in call" guard via presence
 *  9. Ringing tone via Web Audio API (no files)
 * 10. Screen share via getDisplayMedia
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import Peer from 'peerjs';
import { isTestMode, sendTestBroadcast, onTestBroadcast } from '../lib/testMode.js';
import { supabase } from '../lib/supabase.js';
import { useAuth } from './AuthContext.jsx';

const CallContext = createContext(null);

// ── Free TURN servers (Open Relay Project by Metered.ca) ───────────────────
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'turn:openrelay.metered.ca:80',               username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443',              username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443?transport=tcp',username: 'openrelayproject', credential: 'openrelayproject' },
];

// ── Ringing tone via Web Audio API ─────────────────────────────────────────
function createRingTone() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    let osc1, osc2, gainNode, interval;

    const ring = () => {
      osc1 = ctx.createOscillator(); osc2 = ctx.createOscillator();
      gainNode = ctx.createGain();
      osc1.frequency.value = 480; osc2.frequency.value = 620;
      osc1.connect(gainNode); osc2.connect(gainNode);
      gainNode.connect(ctx.destination);
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      osc1.start(); osc2.start();
      gainNode.gain.setValueAtTime(0, ctx.currentTime + 1);
      osc1.stop(ctx.currentTime + 1); osc2.stop(ctx.currentTime + 1);
    };

    ring();
    interval = setInterval(ring, 3000);

    return () => {
      clearInterval(interval);
      try { ctx.close(); } catch (_) {}
    };
  } catch (_) {
    return () => {};
  }
}

export function CallProvider({ children }) {
  const { userId, partnerId, roomId } = useAuth();

  // ── UI State ───────────────────────────────────────────────────────────────
  const [calling, setCalling]         = useState(null); // 'audio'|'video'|null
  const [isRinging, setIsRinging]     = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const [remoteStream, setRemoteStream] = useState(null);
  const [localStream, setLocalStream]   = useState(null);
  const [isMuted, setIsMuted]           = useState(false);
  const [isDeafened, setIsDeafened]     = useState(false);
  const [isCameraOff, setIsCameraOff]   = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callStatus, setCallStatus]     = useState('idle'); // 'idle'|'connecting'|'connected'|'reconnecting'
  const [callQuality, setCallQuality]   = useState('good'); // 'good'|'fair'|'poor'
  const [partnerInCall, setPartnerInCall] = useState(false); // presence guard

  // ── Refs ───────────────────────────────────────────────────────────────────
  const peerRef         = useRef(null);
  const currentCallRef  = useRef(null);
  const dataConnRef     = useRef(null);
  const localStreamRef  = useRef(null);
  const screenTrackRef  = useRef(null);
  const callChannelRef  = useRef(null);
  const channelReadyRef = useRef(false);
  const signalQueueRef  = useRef([]);
  const callTimerRef    = useRef(null);
  const qualityTimerRef = useRef(null);
  const ringRetryRef    = useRef(null);
  const ringTimeoutRef  = useRef(null);
  const ringStopRef     = useRef(null); // stops ringing tone
  const callingRef      = useRef(null);
  const myPeerIdRef     = useRef(null);
  const userIdRef       = useRef(userId);

  const tabIdRef = useRef(Math.random().toString(36).substring(2, 8));
  const myPeerId = userId ? `${userId.slice(0, 8)}-${tabIdRef.current}` : null;

  useEffect(() => { callingRef.current  = calling;  }, [calling]);
  useEffect(() => { myPeerIdRef.current = myPeerId; }, [myPeerId]);
  useEffect(() => { userIdRef.current   = userId;   }, [userId]);

  // ── Call Duration Timer ────────────────────────────────────────────────────
  useEffect(() => {
    if (calling && !isRinging) {
      setCallDuration(0);
      callTimerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
    }
    return () => { if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null; } };
  }, [calling, isRinging]);

  // ── cleanupCall ────────────────────────────────────────────────────────────
  const cleanupCall = useCallback(() => {
    [callTimerRef, qualityTimerRef, ringRetryRef, ringTimeoutRef].forEach(r => {
      if (r.current) { clearInterval(r.current); clearTimeout(r.current); r.current = null; }
    });
    if (ringStopRef.current) { ringStopRef.current(); ringStopRef.current = null; }
    if (screenTrackRef.current) { try { screenTrackRef.current.stop(); } catch(_){} screenTrackRef.current = null; }
    if (localStreamRef.current) { localStreamRef.current.getTracks().forEach(t => t.stop()); localStreamRef.current = null; }
    if (currentCallRef.current) { try { currentCallRef.current.close(); } catch(_){} currentCallRef.current = null; }

    setCalling(null); setIsRinging(false); setIncomingCall(null);
    setRemoteStream(null); setLocalStream(null); setCallDuration(0);
    setIsMuted(false); setIsCameraOff(false); setIsScreenSharing(false);
    setCallStatus('idle'); setCallQuality('good');
  }, []);

  // ── Connection Quality Polling ─────────────────────────────────────────────
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

            // Adaptive bitrate — lower when poor
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

  // ── sendSignal (with queue) ────────────────────────────────────────────────
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

  // ── Track missed call via chat system ─────────────────────────────────────
  const recordMissedCall = useCallback((type) => {
    if (!roomId || !userId) return;
    supabase.from('chat_messages').insert({
      room_id: roomId, sender_id: userId,
      type: 'call_invite', status: 'missed',
      metadata: { callType: type, status: 'missed' },
      content: `${type === 'video' ? 'Video' : 'Voice'} Call (Missed)`
    }).then(({ error }) => { if (error) console.warn('[Call] Missed call log failed:', error.message); });
  }, [roomId, userId]);

  // ── ICE state handler (reconnecting) ──────────────────────────────────────
  const attachIceHandlers = useCallback((call) => {
    const pc = call.peerConnection;
    if (!pc) return;

    pc.oniceconnectionstatechange = () => {
      const s = pc.iceConnectionState;
      console.log('[Call] ICE state:', s);
      if (s === 'disconnected' || s === 'failed') {
        setCallStatus('reconnecting');
        // Attempt ICE restart
        if (s === 'failed') { try { pc.restartIce(); } catch(_){} }
      } else if (s === 'connected' || s === 'completed') {
        setCallStatus('connected');
        startQualityMonitor();
      }
    };
  }, [startQualityMonitor]);

  // ── handleSignal ───────────────────────────────────────────────────────────
  const handleSignal = useCallback((payload) => {
    const self = myPeerIdRef.current;
    console.log('[Call] ←', payload.action, '| self:', self);

    switch (payload.action) {

      case 'ring': {
        if (payload.callerPeerId === self) return;
        // Guard: if we're already in a call, send busy signal
        if (callingRef.current) {
          sendSignal({ action: 'busy', to: payload.callerPeerId });
          return;
        }
        setIncomingCall({ type: payload.type, callerPeerId: payload.callerPeerId, fromName: payload.fromName });
        setIsRinging(true);
        // Play ringing tone for receiver
        if (ringStopRef.current) ringStopRef.current();
        ringStopRef.current = createRingTone();
        break;
      }

      case 'busy': {
        if (payload.to && payload.to !== self) return;
        setCallStatus('idle');
        cleanupCall();
        window.dispatchEvent(new CustomEvent('call_busy'));
        break;
      }

      case 'accepted': {
        if (payload.receiverPeerId === self) return;
        console.log('[Call] Accepted by', payload.receiverPeerId, '— initiating PeerJS call');
        // Stop ringing tone on caller side
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
          call.on('stream', (rs) => { setRemoteStream(rs); setCalling(payload.type || 'audio'); setCallStatus('connected'); });
          call.on('close',  () => cleanupCall());
          call.on('error',  () => cleanupCall());
        } else {
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

  // ── Initialize PeerJS ──────────────────────────────────────────────────────
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

        call.on('stream', (rs) => { setRemoteStream(rs); setCalling(call.metadata?.type || 'audio'); setIsRinging(false); setCallStatus('connected'); });
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
        const retriable = ['network','server-error','socket-error','socket-closed'];
        if (retriable.includes(err.type) && mounted && retryCount < 5) {
          retryCount++;
          retryTimeout = setTimeout(initPeer, 3000);
        }
      });
    };

    initPeer();

    // ICE restart when network comes back online
    const onOnline = () => {
      console.log('[Call] Network restored — attempting ICE restart');
      const pc = currentCallRef.current?.peerConnection;
      if (pc) { try { pc.restartIce(); } catch(_){} }
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

  // ── Supabase Signaling Channel ─────────────────────────────────────────────
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
          // Track own presence
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

  // ── Test Mode + Global Fallback ────────────────────────────────────────────
  useEffect(() => {
    if (!isTestMode()) return;
    return onTestBroadcast('call_signal', handleSignal);
  }, [handleSignal]);

  useEffect(() => {
    const h = ({ detail: { event, payload } }) => { if (event === 'call_signal') handleSignal(payload); };
    window.addEventListener('sync_broadcast', h);
    return () => window.removeEventListener('sync_broadcast', h);
  }, [handleSignal]);

  // ════════════════════════════════════════════════════════════════════════════
  // Public API
  // ════════════════════════════════════════════════════════════════════════════

  const startCall = useCallback(async (type) => {
    if (!partnerId || !myPeerId) return;
    if (partnerInCall) { alert(`${partnerId} is already on another call.`); return; }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === 'video' });
      localStreamRef.current = stream;
      setLocalStream(stream); setCalling(type); setIsRinging(true);
      setIsCameraOff(type === 'audio'); setCallStatus('connecting');

      const payload = { action: 'ring', callerPeerId: myPeerId, type, fromName: userIdRef.current };
      sendSignal(payload);

      // Play outbound ringing tone
      if (ringStopRef.current) ringStopRef.current();
      ringStopRef.current = createRingTone();

      // Retry ring every 4s in case partner just loaded
      ringRetryRef.current = setInterval(() => sendSignal(payload), 4000);

      // Auto-cancel after 30s (missed call)
      ringTimeoutRef.current = setTimeout(() => {
        if (isRinging) { // only if still ringing
          recordMissedCall(type);
          cleanupCall();
        }
      }, 30000);

    } catch (e) {
      console.error('[Call] startCall failed:', e);
      cleanupCall();
      alert('Could not access microphone/camera. Please check browser permissions.');
    }
  }, [partnerId, myPeerId, partnerInCall, sendSignal, cleanupCall, recordMissedCall, isRinging]);

  const acceptCall = useCallback(async () => {
    const incoming = incomingCall;
    if (!incoming) return;

    // Stop receiver ringing tone
    if (ringStopRef.current) { ringStopRef.current(); ringStopRef.current = null; }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: incoming.type === 'video' });
      localStreamRef.current = stream;
      setLocalStream(stream); setCalling(incoming.type); setIsRinging(false);
      setIncomingCall(null); setIsCameraOff(incoming.type === 'audio'); setCallStatus('connecting');

      const selfId = myPeerIdRef.current;
      sendSignal({ action: 'accepted', receiverPeerId: selfId, type: incoming.type });
      // Caller now calls us — peer.on('call') handles the answer
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

  const endCall = useCallback(() => {
    sendSignal({ action: 'ended' });
    cleanupCall();
  }, [sendSignal, cleanupCall]);

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
        setCalling('video');
        sendSignal({ action: 'upgrade', type: 'video' });
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
        if (sender) sender.replaceTrack(screenTrack);
        else pc.addTrack(screenTrack, localStreamRef.current);
      }
      setIsScreenSharing(true);
      setCalling('video');
      sendSignal({ action: 'upgrade', type: 'video' });

      screenTrack.onended = () => stopScreenShare();
    } catch (e) {
      console.error('[Call] Screen share failed:', e);
    }
  }, [sendSignal]);

  const stopScreenShare = useCallback(async () => {
    if (screenTrackRef.current) { screenTrackRef.current.stop(); screenTrackRef.current = null; }
    setIsScreenSharing(false);
    // Switch back to camera
    try {
      const vs = await navigator.mediaDevices.getUserMedia({ video: true });
      const vt = vs.getVideoTracks()[0];
      const pc = currentCallRef.current?.peerConnection;
      if (pc && vt) {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(vt);
      }
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
