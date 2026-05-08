/**
 * CallContext.jsx — Native WebRTC, zero PeerJS dependency.
 *
 * Signaling over Supabase broadcast (room_call_${roomId}):
 *   ring      → caller announces
 *   accepted  → receiver accepted, trigger offer
 *   offer     → caller's SDP offer
 *   answer    → receiver's SDP answer
 *   ice       → trickle ICE candidates (both sides)
 *   ended     → hang-up
 *   busy      → receiver already in call
 *
 * Timer starts on ICE 'connected' state (not before).
 * Remote audio is wired directly via a ref in CallOverlay.
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from './AuthContext.jsx';
import { isTestMode, sendTestBroadcast, onTestBroadcast } from '../lib/testMode.js';

const CallContext = createContext(null);

// ── ICE servers ──────────────────────────────────────────────────────────────
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun.metered.ca:80' },
  {
    urls: [
      `turn:relay.metered.ca:3478?transport=udp`,
      `turn:relay.metered.ca:3478?transport=tcp`,
      `turn:relay.metered.ca:443?transport=tcp`,
      `turn:relay.metered.ca:80?transport=tcp`
    ],
    username: import.meta.env.VITE_TURN_USERNAME || '7b7a36e720529076fafd84b7',
    credential: import.meta.env.VITE_TURN_PASSWORD || 'londsjncTUuBxGCU'
  }
];

console.log('[WebRTC] ICE Config Loaded:', ICE_SERVERS.map(s => ({ 
  urls: s.urls, 
  user: s.username ? `${s.username.slice(0,4)}...` : 'none',
  hasPass: !!s.credential 
})));

// Warn if TURN credentials look missing or are using the public fallback
(() => {
  const u = import.meta.env.VITE_TURN_USERNAME;
  const p = import.meta.env.VITE_TURN_PASSWORD;
  if (!u || !p || u === 'openrelayproject' || p === 'openrelayproject') {
    console.warn('[WebRTC] TURN credentials appear missing or default. Verify Metered.ca credentials and Vercel `VITE_TURN_USERNAME`/`VITE_TURN_PASSWORD` env vars.');
  }
})();

// ── Ringing tone (Web Audio) ─────────────────────────────────────────────────
function createRingTone() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    let interval;
    const ring = () => {
      const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
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

// ── Provider ─────────────────────────────────────────────────────────────────
export function CallProvider({ children }) {
  const { userId, partnerId, roomId } = useAuth();

  // ── UI state ─────────────────────────────────────────────────────────────
  const [calling,       setCalling]       = useState(null);   // 'audio'|'video'|null
  const [isRinging,     setIsRinging]     = useState(false);
  const [incomingCall,  setIncomingCall]  = useState(null);
  const [callDuration,  setCallDuration]  = useState(0);
  const [remoteStream,  setRemoteStream]  = useState(null);
  const [localStream,   setLocalStream]   = useState(null);
  const [isMuted,       setIsMuted]       = useState(false);
  const [isDeafened,    setIsDeafened]    = useState(false);
  const [isCameraOff,   setIsCameraOff]   = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callStatus,    setCallStatus]    = useState('idle');
  const [callQuality,   setCallQuality]   = useState('good');
  const [partnerInCall, setPartnerInCall] = useState(false);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const pcRef              = useRef(null);  // RTCPeerConnection
  const localStreamRef     = useRef(null);
  const screenTrackRef     = useRef(null);
  const callChannelRef     = useRef(null);
  const channelReadyRef    = useRef(false);
  const signalQueueRef     = useRef([]);
  const callTimerRef       = useRef(null);
  const qualityTimerRef    = useRef(null);
  const ringRetryRef       = useRef(null);
  const ringTimeoutRef     = useRef(null);
  const ringStopRef        = useRef(null);
  const callStatusRef      = useRef('idle');
  const callDurationRef    = useRef(0);
  const pendingCandidates  = useRef([]);   // ICE queue before remote desc is set
  const isCallerRef        = useRef(false);
  const callTypeRef        = useRef(null);
  const isRingingRef       = useRef(false);
  const callingRef         = useRef(null);
  const makingOfferRef     = useRef(false); // glare prevention

  useEffect(() => { callingRef.current  = calling;  }, [calling]);
  useEffect(() => { isRingingRef.current = isRinging; }, [isRinging]);
  useEffect(() => { callStatusRef.current = callStatus; }, [callStatus]);
  useEffect(() => { callDurationRef.current = callDuration; }, [callDuration]);

  // ── Timer: starts exactly when ICE connects ───────────────────────────────
  useEffect(() => {
    if (callStatus === 'connected') {
      setCallDuration(0);
      callTimerRef.current = setInterval(() => setCallDuration(d => {
        const next = d + 1;
        callDurationRef.current = next;
        return next;
      }), 1000);
    } else {
      if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null; }
    }
    return () => { if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null; } };
  }, [callStatus]);

  // ── cleanupCall ───────────────────────────────────────────────────────────
  const cleanupCall = useCallback(() => {
    console.log('[Call] Cleaning up all call state and stopping tracks...');
    [callTimerRef, qualityTimerRef, ringRetryRef, ringTimeoutRef].forEach(r => {
      if (r.current) { clearInterval(r.current); clearTimeout(r.current); r.current = null; }
    });
    if (ringStopRef.current)  { ringStopRef.current(); ringStopRef.current = null; }
    if (screenTrackRef.current) { try { screenTrackRef.current.stop(); } catch(_){} screenTrackRef.current = null; }
    
    // Exhaustive track stopping
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => {
        console.log(`[Call] Stopping local track: ${t.kind}`);
        t.stop();
      });
      localStreamRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.getSenders().forEach(s => { if (s.track) s.track.stop(); });
      try { pcRef.current.close(); } catch(_){}
      pcRef.current = null;
    }
    pendingCandidates.current = [];
    makingOfferRef.current = false;
    isCallerRef.current = false;

    setCalling(null); setIsRinging(false); setIncomingCall(null);
    setRemoteStream(null); setLocalStream(null); setCallDuration(0);
    setIsMuted(false); setIsCameraOff(false); setIsScreenSharing(false);
    setCallStatus('idle'); setCallQuality('good');
  }, []);

  // ── sendSignal (with queue for pre-subscription signals) ──────────────────
  const sendSignal = useCallback((payload) => {
    const msg = { type: 'broadcast', event: 'call_signal', payload: { ...payload, from: userId } };
    console.log(`[Call] Signaling OUT: ${payload.action}`, payload);
    if (channelReadyRef.current && callChannelRef.current) {
      callChannelRef.current.send(msg);
    } else {
      console.warn(`[Call] Channel not ready, queuing signal: ${payload.action}`);
      signalQueueRef.current.push(msg);
    }
    if (isTestMode()) sendTestBroadcast('call_signal', payload);
  }, [userId]);

  const flushQueue = useCallback(() => {
    const q = signalQueueRef.current.splice(0);
    q.forEach(m => callChannelRef.current?.send(m));
  }, []);

  // ── recordCallEnd / recordMissedCall ─────────────────────────────────────
  const recordCallEnd = useCallback((type, duration) => {
    if (!roomId || !userId) return;
    const m = Math.floor(duration / 60), s = duration % 60;
    supabase.from('chat_messages').insert({
      room_id: roomId, sender_id: userId,
      type: 'call_invite',
      content: `${type === 'video' ? 'Video' : 'Voice'} Call · ${m}:${String(s).padStart(2,'0')}`,
      metadata: { callType: type || 'audio', status: 'ended', duration: `${m}:${String(s).padStart(2,'0')}` },
    }).then(({ error }) => { if (error) console.warn('[Call] End log failed:', error.message); });
  }, [roomId, userId]);

  const recordMissedCall = useCallback((type) => {
    if (!roomId || !userId) return;
    supabase.from('chat_messages').insert({
      room_id: roomId, sender_id: userId,
      type: 'call_invite',
      content: `${type === 'video' ? 'Video' : 'Voice'} Call (Missed)`,
      metadata: { callType: type || 'audio', status: 'missed' },
    }).then(({ error }) => { if (error) console.warn('[Call] Missed log failed:', error.message); });
  }, [roomId, userId]);

  // ── RTCPeerConnection factory ─────────────────────────────────────────────
  const createPC = useCallback((type) => {
    if (pcRef.current) { try { pcRef.current.close(); } catch(_){} }
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS, iceCandidatePoolSize: 10 });
    pcRef.current = pc;

    // Send our tracks to remote
    if (localStreamRef.current) {
      console.log('[WebRTC] Adding local tracks to PC:', localStreamRef.current.getTracks().map(t => t.kind));
      localStreamRef.current.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current));
    }

    // Receive remote tracks
    pc.ontrack = (e) => {
      console.log('[Call] ontrack — remote track received:', e.track.kind);
      setRemoteStream(prev => {
        if (prev) {
          // If the stream already exists, add the track if it's not there
          if (!prev.getTracks().find(t => t.id === e.track.id)) {
            prev.addTrack(e.track);
          }
          return new MediaStream(prev.getTracks()); // trigger re-render
        }
        return e.streams[0] || new MediaStream([e.track]);
      });
    };

    // Trickle ICE
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        const type = e.candidate.candidate.split(' ')[7]; // Simple way to get candidate type
        console.log(`[Call] Local ICE Candidate (${type}):`, e.candidate.candidate);
        sendSignal({ action: 'ice', candidate: e.candidate.toJSON() });
      } else {
        console.log('[Call] ICE Gathering Complete');
      }
    };
    
    pc.onicegatheringstatechange = () => {
      console.log('[Call] ICE Gathering State:', pc.iceGatheringState);
    };

    pc.onconnectionstatechange = () => {
      console.log('[Call] Peer Connection State:', pc.connectionState);
    };

    // ICE state machine
    pc.oniceconnectionstatechange = () => {
      const s = pc.iceConnectionState;
      console.log('[Call] ICE Connection State:', s);
      if (s === 'connected' || s === 'completed') {
        setCallStatus('connected');
        setCalling(callTypeRef.current);
        setIsRinging(false);
        console.log('[Call] WebRTC Connected Successfully');
        startQualityMonitor(pc);
      } else if (s === 'disconnected') {
        console.warn('[Call] ICE Disconnected - partner might have network issues');
        setCallStatus('reconnecting');
        setTimeout(() => {
          if (pcRef.current?.iceConnectionState === 'disconnected') {
            console.log('[Call] Attempting ICE Restart...');
            try { pcRef.current.restartIce(); } catch(e){ console.error('[Call] Restart ICE failed:', e); }
          }
        }, 2000);
      } else if (s === 'failed') {
        console.error('[Call] ICE Connection Failed. Possible TURN issue or symmetric NAT.');
        setCallStatus('reconnecting');
        if (isCallerRef.current) {
          console.log('[Call] Caller triggering ICE restart due to failure');
          try { pcRef.current?.restartIce(); } catch(e){ console.error('[Call] Restart ICE failed:', e); }
        }
      } else if (s === 'closed') {
        cleanupCall();
      }
    };

    pc.onsignalingstatechange = () => {
      console.log('[Call] Signaling State:', pc.signalingState);
    };

    // Negotiation needed (for re-negotiation e.g. screen share)
    pc.onnegotiationneeded = async () => {
      console.log('[Call] onnegotiationneeded firing. isCaller:', isCallerRef.current, 'signalingState:', pc.signalingState);
      if (!isCallerRef.current || makingOfferRef.current) return;
      try {
        makingOfferRef.current = true;
        const offer = await pc.createOffer();
        if (pc.signalingState !== 'stable') {
          console.warn('[Call] Signaling state not stable during negotiation, ignoring offer creation');
          return;
        }
        await pc.setLocalDescription(offer);
        sendSignal({ action: 'offer', sdp: pc.localDescription, callType: callTypeRef.current });
      } catch (e) {
        console.error('[Call] onnegotiationneeded error:', e);
      } finally {
        makingOfferRef.current = false;
      }
    };

    return pc;
  }, [sendSignal, cleanupCall]);

  // ── Quality monitor ───────────────────────────────────────────────────────
  const startQualityMonitor = useCallback((pc) => {
    if (qualityTimerRef.current) clearInterval(qualityTimerRef.current);
    qualityTimerRef.current = setInterval(async () => {
      if (!pc || pc.connectionState === 'closed') return;
      try {
        const stats = await pc.getStats();
        stats.forEach(r => {
          if (r.type === 'inbound-rtp' && r.kind === 'audio' && r.packetsReceived > 0) {
            const loss = (r.packetsLost || 0) / (r.packetsReceived + (r.packetsLost || 0));
            setCallQuality(loss < 0.02 ? 'good' : loss < 0.08 ? 'fair' : 'poor');
          }
        });
      } catch (_) {}
    }, 4000);
  }, []);

  // ── applyPendingCandidates — flush queued ICE candidates ─────────────────
  const applyPendingCandidates = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || !pc.remoteDescription) return;
    const queue = pendingCandidates.current.splice(0);
    for (const c of queue) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch (_) {}
    }
  }, []);

  // ── handleSignal ──────────────────────────────────────────────────────────
  const handleSignal = useCallback(async (payload) => {
    if (!payload || payload.from === userId) return; // ignore own signals
    console.log(`[Call] Signaling IN: ${payload.action}`, payload);

    switch (payload.action) {

      case 'ring': {
        if (callingRef.current) {
          sendSignal({ action: 'busy' });
          return;
        }
        setIncomingCall({ type: payload.callType || 'audio', fromName: payload.fromName });
        setIsRinging(true);
        if (ringStopRef.current) ringStopRef.current();
        ringStopRef.current = createRingTone();
        break;
      }

      case 'busy': {
        cleanupCall();
        window.dispatchEvent(new CustomEvent('call_busy'));
        break;
      }

      case 'accepted': {
        // I am the caller. Receiver accepted → create and send offer.
        if (!isCallerRef.current) return;
        if (ringRetryRef.current) { clearInterval(ringRetryRef.current); ringRetryRef.current = null; }
        if (ringTimeoutRef.current) { clearTimeout(ringTimeoutRef.current); ringTimeoutRef.current = null; }
        if (ringStopRef.current) { ringStopRef.current(); ringStopRef.current = null; }
        setIsRinging(false);
        setCallStatus('connecting');

        try {
          makingOfferRef.current = true;
          const pc = createPC(payload.callType);
          const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: payload.callType === 'video' });
          await pc.setLocalDescription(offer);
          sendSignal({ action: 'offer', sdp: pc.localDescription, callType: payload.callType });
        } catch (e) {
          console.error('[Call] offer creation failed:', e);
          cleanupCall();
        } finally {
          makingOfferRef.current = false;
        }
        break;
      }

      case 'offer': {
        // I am the receiver. Caller sent SDP offer.
        if (isCallerRef.current) return;
        setCallStatus('connecting');
        callTypeRef.current = payload.callType || 'audio';
        try {
          // Get media if not already acquired (stop any stale tracks first)
          if (!localStreamRef.current) {
            // Defensive: stop any lingering local tracks before re-acquiring camera/mic
            try { if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop()); } catch(_){}
            const stream = await navigator.mediaDevices.getUserMedia({
              audio: true,
              video: payload.callType === 'video',
            });
            localStreamRef.current = stream;
            setLocalStream(stream);
          }

          const pc = createPC(payload.callType);
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          await applyPendingCandidates();

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendSignal({ action: 'answer', sdp: pc.localDescription });
        } catch (e) {
          console.error('[Call] offer handling failed:', e);
          cleanupCall();
        }
        break;
      }

      case 'answer': {
        // I am the caller. Receiver sent SDP answer.
        if (!isCallerRef.current) return;
        const pc = pcRef.current;
        if (!pc || pc.signalingState === 'stable') return;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          await applyPendingCandidates();
        } catch (e) {
          console.error('[Call] answer handling failed:', e);
        }
        break;
      }

      case 'ice': {
        const pc = pcRef.current;
        if (!pc || !payload.candidate) return;
        if (pc.remoteDescription) {
          try { await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)); } catch (_) {}
        } else {
          // Queue until remote description is set
          pendingCandidates.current.push(payload.candidate);
        }
        break;
      }

      case 'ended': {
        const wasConnected = callStatusRef.current === 'connected';
        const dur = callDurationRef.current;
        if (wasConnected && callTypeRef.current) {
          recordCallEnd(callTypeRef.current, dur);
        }
        cleanupCall();
        break;
      }

      default: break;
    }
  }, [userId, sendSignal, cleanupCall, createPC, applyPendingCandidates, recordCallEnd]);

  // ── Supabase signaling channel ────────────────────────────────────────────
  useEffect(() => {
    if (!roomId || !userId) return;
    const channelId = `room_call_${roomId}`;
    const channel = supabase.channel(channelId, { config: { broadcast: { self: false, ack: false } } });
    callChannelRef.current = channel;
    channelReadyRef.current = false;

    channel
      .on('broadcast', { event: 'call_signal' }, ({ payload }) => handleSignal(payload))
      .on('presence', { event: 'sync' }, () => {
        try {
          const state = channel.presenceState();
          const partnerP = Object.values(state).flat().filter(Boolean).find(p => p && p.userId !== userId);
          setPartnerInCall(!!(partnerP?.inCall));
        } catch (_) {}
      })
      .subscribe(async (status) => {
        console.log('[Call] channel:', status);
        if (status === 'SUBSCRIBED') {
          channelReadyRef.current = true;
          flushQueue();
          try { await channel.track({ userId, inCall: false }); } catch (_) {}
        } else {
          channelReadyRef.current = false;
        }
      });

    return () => {
      channelReadyRef.current = false;
      try { channel.unsubscribe(); } catch (_) {}
      callChannelRef.current = null;
    };
  }, [roomId, userId, handleSignal, flushQueue]);

  // Update presence when call active
  useEffect(() => {
    if (channelReadyRef.current && callChannelRef.current) {
      try { callChannelRef.current.track({ userId, inCall: !!calling }); } catch (_) {}
    }
  }, [calling, userId]);

  // Network restore — attempt ICE restart
  useEffect(() => {
    const onOnline = () => {
      const pc = pcRef.current;
      if (pc && (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed')) {
        try { pc.restartIce(); } catch (_) {}
      }
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);

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

  // ── Public API ────────────────────────────────────────────────────────────

  const startCall = useCallback(async (type) => {
    if (!partnerId || !userId) return;
    if (callingRef.current) return; // already in a call

    try {
      // Defensive: stop any lingering local tracks before re-acquiring camera/mic
      if (localStreamRef.current) {
        try { localStreamRef.current.getTracks().forEach(t => t.stop()); } catch(_){}
        localStreamRef.current = null; setLocalStream(null);
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === 'video' });
      localStreamRef.current = stream;
      callTypeRef.current = type;
      isCallerRef.current = true;

      setLocalStream(stream);
      setCalling(type);
      setIsRinging(true);
      setIsCameraOff(type === 'audio');
      setCallStatus('connecting');

      const ringPayload = { action: 'ring', callType: type, fromName: userId };
      sendSignal(ringPayload);

      if (ringStopRef.current) ringStopRef.current();
      ringStopRef.current = createRingTone();

      // Retry ring every 4s
      ringRetryRef.current = setInterval(() => sendSignal(ringPayload), 4000);

      // 30s timeout → missed call
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
  }, [partnerId, userId, partnerInCall, sendSignal, cleanupCall, recordMissedCall]);

  const acceptCall = useCallback(async () => {
    const incoming = incomingCall;
    if (!incoming) return;

    if (ringStopRef.current) { ringStopRef.current(); ringStopRef.current = null; }
    isCallerRef.current = false;
    callTypeRef.current = incoming.type;

    try {
      // Defensive: stop any lingering local tracks before re-acquiring camera/mic
      if (localStreamRef.current) {
        try { localStreamRef.current.getTracks().forEach(t => t.stop()); } catch(_){}
        localStreamRef.current = null; setLocalStream(null);
      }
      // Get media early so it's ready when offer arrives
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: incoming.type === 'video' });
      localStreamRef.current = stream;
      setLocalStream(stream);
      setCalling(incoming.type);
      setIsRinging(false);
      setIncomingCall(null);
      setIsCameraOff(incoming.type === 'audio');
      setCallStatus('connecting');

      // Tell caller we accepted — they will now send the offer
      sendSignal({ action: 'accepted', callType: incoming.type });
    } catch (err) {
      console.error('[Call] acceptCall failed:', err);
      cleanupCall();
    }
  }, [incomingCall, sendSignal, cleanupCall]);

  const declineCall = useCallback(() => {
    if (ringStopRef.current) { ringStopRef.current(); ringStopRef.current = null; }
    sendSignal({ action: 'ended' });
    setIncomingCall(null);
    setIsRinging(false);
  }, [sendSignal]);

  const endCall = useCallback(() => {
    if (callTypeRef.current && callStatus === 'connected') {
      recordCallEnd(callTypeRef.current, callDuration);
    }
    sendSignal({ action: 'ended' });
    cleanupCall();
  }, [sendSignal, cleanupCall, recordCallEnd, callStatus, callDuration]);

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
      if (callTypeRef.current === 'audio') {
        callTypeRef.current = 'video';
        setCalling('video');
      }
      try {
        const vs = await navigator.mediaDevices.getUserMedia({ video: true });
        const vt = vs.getVideoTracks()[0];
        if (vt && localStreamRef.current && pcRef.current) {
          // Stop old video tracks first
          localStreamRef.current.getVideoTracks().forEach(t => {
            localStreamRef.current.removeTrack(t);
            t.stop();
          });
          localStreamRef.current.addTrack(vt);
          const sender = pcRef.current.getSenders().find(s => s.track?.kind === 'video');
          if (sender) await sender.replaceTrack(vt); else pcRef.current.addTrack(vt, localStreamRef.current);
          setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
        }
      } catch (e) { console.error('[Call] camera toggle failed:', e); setIsCameraOff(true); }
    } else {
      localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = false; });
    }
  }, [isCameraOff]);

  // ── ICE restart (caller-side only) ────────────────────────────────────────
  const restartIce = useCallback(() => {
    try { pcRef.current?.restartIce(); } catch (e) { console.warn('[Call] restartIce failed:', e); }
  }, []);

  // ── Change input device mid-call ────────────────────────────────────────────
  const changeDevice = useCallback(async (kind, deviceId) => {
    if (!localStreamRef.current || !pcRef.current) return;
    try {
      // Stop relevant old tracks first to avoid NotReadableError
      const oldTracks = kind === 'audioinput'
        ? localStreamRef.current.getAudioTracks()
        : localStreamRef.current.getVideoTracks();
      oldTracks.forEach(t => { localStreamRef.current.removeTrack(t); t.stop(); });

      const constraints = kind === 'audioinput'
        ? { audio: { deviceId: { exact: deviceId } } }
        : { video: { deviceId: { exact: deviceId } } };
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      const newTrack = kind === 'audioinput' ? newStream.getAudioTracks()[0] : newStream.getVideoTracks()[0];
      const sender = pcRef.current.getSenders().find(s => s.track?.kind === (kind === 'audioinput' ? 'audio' : 'video'));
      if (sender && newTrack) {
        await sender.replaceTrack(newTrack);
        localStreamRef.current.addTrack(newTrack);
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
      }
    } catch (e) { console.error('[Call] changeDevice failed:', e); }
  }, []);

  const startScreenShare = useCallback(async () => {
    try {
      const ss = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const st = ss.getVideoTracks()[0];
      screenTrackRef.current = st;
      const sender = pcRef.current?.getSenders().find(s => s.track?.kind === 'video');
      if (sender) sender.replaceTrack(st); else pcRef.current?.addTrack(st, localStreamRef.current);
      setIsScreenSharing(true);
      setCalling('video');
      callTypeRef.current = 'video';
      st.onended = () => stopScreenShare();
    } catch (e) { console.error('[Call] screen share failed:', e); }
  }, []);

  const stopScreenShare = useCallback(async () => {
    if (screenTrackRef.current) { screenTrackRef.current.stop(); screenTrackRef.current = null; }
    setIsScreenSharing(false);
    try {
      const vs = await navigator.mediaDevices.getUserMedia({ video: true });
      const vt = vs.getVideoTracks()[0];
      const sender = pcRef.current?.getSenders().find(s => s.track?.kind === 'video');
      if (sender && vt) sender.replaceTrack(vt);
    } catch (_) {}
  }, []);

  const testTurnConfig = useCallback(async () => {
    // Get the first TURN server config for logging
    const turnServer = ICE_SERVERS.find(s => {
      const u = Array.isArray(s.urls) ? s.urls[0] : s.urls;
      return u?.includes('turn:');
    });
    console.log('[Debug] Starting TURN connectivity test...');
    
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const results = [];
    const errors = [];
    
    pc.onicecandidateerror = (e) => {
      const err = `Error ${e.errorCode}: ${e.errorText}`;
      console.error(`[Debug] ICE Error on ${e.url}: ${err}`);
      errors.push({ code: e.errorCode, text: e.errorText, url: e.url });
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        const type = e.candidate.candidate.split(' ')[7];
        results.push(type);
        console.log(`[Debug] Found candidate: ${type}`);
      } else {
        const hasRelay = results.includes('relay');
        console.log(`[Debug] Test Complete. Relay found: ${hasRelay}`);
        
        // Dispatch result with extra error info for the UI
        window.dispatchEvent(new CustomEvent('turn_test_result', { 
          detail: { 
            hasRelay, 
            types: results,
            errorCode: errors.length > 0 ? errors[0].code : null,
            errorText: errors.length > 0 ? errors[0].text : null
          } 
        }));
        pc.close();
      }
    };
    pc.createDataChannel('test');
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    return true;
  }, []);

  const value = {
    calling, isRinging, incomingCall, callDuration, callStatus, callQuality,
    remoteStream, localStream, isMuted, isDeafened, isCameraOff, isScreenSharing,
    partnerInCall,
    startCall, acceptCall, declineCall, endCall,
    toggleMic, toggleCamera, toggleDeafen,
    startScreenShare, stopScreenShare,
    restartIce, changeDevice, testTurnConfig,
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used within a CallProvider');
  return ctx;
}
