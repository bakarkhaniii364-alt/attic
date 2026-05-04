import { useState, useEffect, useRef, useCallback } from 'react';
import Peer from 'peerjs';
import { supabase } from '../lib/supabase.js';
import { isTestMode } from '../lib/testMode.js';
import { playAudio } from '../utils/audio.js';

/**
 * useWebRTC - Specialized hook for PeerJS signaling and media streams.
 * Enforces a strict one-way handshake to prevent race conditions.
 */
export function useWebRTC(userId, partnerId, partnerName, syncedRoomId, sfxEnabled, toast, syncSendMessage, syncUpdateMessage, chatHistory) {
  const [calling, setCalling] = useState(null);
  const [isRinging, setIsRinging] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const [remoteStream, setRemoteStream] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  
  // Settings/Controls
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  const peerRef = useRef(null);
  const currentCallRef = useRef(null);
  const localStreamRef = useRef(null);
  const tabIdRef = useRef(Math.random().toString(36).substring(2, 8));
  const ringingIntervalRef = useRef(null);
  const callTimerRef = useRef(null);
  const myPeerId = userId ? `${userId}-${tabIdRef.current}` : null;

  // 1. Initialize PeerJS with Exponential Backoff
  useEffect(() => {
    if (!userId) return;
    
    let retryCount = 0;
    let retryTimeout = null;
    let isMounted = true;

    const initPeer = () => {
      if (!isMounted) return;

      if (peerRef.current && !peerRef.current.destroyed) {
        try { 
          peerRef.current.disconnect(); 
          peerRef.current.destroy(); 
        } catch(e) {}
        peerRef.current = null;
      }

      const peer = new Peer(myPeerId, { 
        debug: 1,
        config: { iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }, 
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
        ] }
      });
      
      peerRef.current = peer;

      peer.on('open', () => {
        if (!isMounted) return;
        console.log(`[WebRTC] Connected to signaling server as ${myPeerId}`);
        retryCount = 0;
      });

      peer.on('call', (call) => {
        console.log("[WebRTC] Incoming call received via PeerJS");
        currentCallRef.current = call;
        
        // Listen for stream from caller
        call.on('stream', (rs) => {
          console.log("[WebRTC] Remote stream received");
          setRemoteStream(rs);
        });

        call.on('close', () => endCall());
        call.on('error', (err) => {
          console.error("[WebRTC] Call error:", err);
          endCall();
        });

        // If we are already in an 'accepted' state and have a stream, answer immediately
        // Otherwise, acceptCall() will handle answering
        if (localStreamRef.current) {
          call.answer(localStreamRef.current);
        }
      });

      peer.on('error', (err) => {
        if (!isMounted) return;
        console.error(`[WebRTC] Peer error (${err.type}):`, err);
        
        if (['disconnected', 'network', 'unavailable-id', 'socket-error'].includes(err.type)) {
          retryCount++;
          const delay = Math.min(2000 * Math.pow(2, retryCount), 15000); 
          console.warn(`[WebRTC] Retrying connection in ${delay/1000}s...`);
          
          if (peerRef.current) {
            try { peerRef.current.disconnect(); peerRef.current.destroy(); } catch(e){}
            peerRef.current = null;
          }
          
          if (retryTimeout) clearTimeout(retryTimeout);
          retryTimeout = setTimeout(initPeer, delay);
        }
      });
    };

    retryTimeout = setTimeout(initPeer, 500);

    return () => { 
      isMounted = false;
      if (retryTimeout) clearTimeout(retryTimeout);
      if (peerRef.current) {
        const p = peerRef.current;
        p.disconnect();
        p.on('disconnected', () => { if (!p.destroyed) p.destroy(); });
        peerRef.current = null;
      }
    };
  }, [userId, myPeerId]);

  // 2. Call Handlers
  const endCall = useCallback((silent = false) => {
    console.log("[WebRTC] Ending call...");
    if (!silent) playAudio('click', sfxEnabled);

    // 1. Broadcast "ended" signal
    const channel = supabase.channel(`room_${syncedRoomId}`);
    channel.send({
      type: 'broadcast',
      event: 'call_signal',
      payload: { action: 'ended' }
    });

    // 2. Cleanup local state
    setCalling(null);
    setIsRinging(false);
    setIncomingCall(null);
    setRemoteStream(null);
    setCallDuration(0);
    
    // 3. Stop tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }

    // 4. Close PeerJS call
    if (currentCallRef.current) {
      try { currentCallRef.current.close(); } catch(e){}
      currentCallRef.current = null;
    }

    // 5. Cleanup timers
    if (ringingIntervalRef.current) {
      clearInterval(ringingIntervalRef.current);
      ringingIntervalRef.current = null;
    }
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
  }, [syncedRoomId, sfxEnabled]);

  const startCall = useCallback(async (type) => {
    if (calling || isRinging) return;
    playAudio('click', sfxEnabled);
    
    setCalling(type);
    setIsRinging(true);
    setIsCameraOff(type === 'audio');

    // Signaling: Notify partner
    const channel = supabase.channel(`room_${syncedRoomId}`);
    channel.send({
      type: 'broadcast',
      event: 'call_signal',
      payload: { action: 'ring', callerPeerId: myPeerId, type }
    });

    // Persistence: Add to chat history
    if (syncSendMessage) {
      syncSendMessage('Incoming call...', 'call_invite', { callType: type, status: 'ringing' });
    }
  }, [calling, isRinging, sfxEnabled, syncedRoomId, myPeerId, userId, syncSendMessage]);

  const acceptCall = useCallback(async () => {
    if (!incomingCall) return;
    playAudio('click', sfxEnabled);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: incomingCall.type === 'video' 
      });

      localStreamRef.current = stream;
      setLocalStream(stream);
      
      // Signaling: Send Answer back with my ID
      const channel = supabase.channel(`room_${syncedRoomId}`);
      channel.send({
        type: 'broadcast',
        event: 'call_signal',
        payload: { action: 'answered', answererPeerId: myPeerId }
      });

      // If we already have the incoming call object from PeerJS, answer it
      if (currentCallRef.current) {
        currentCallRef.current.answer(stream);
      }

      setCalling(incomingCall.type);
      setIncomingCall(null);
      setIsRinging(false);
      
      if (ringingIntervalRef.current) {
        clearInterval(ringingIntervalRef.current);
        ringingIntervalRef.current = null;
      }

      // Update chat message status
      const ringingInvite = chatHistory?.find(m => m.type === 'call_invite' && m.status === 'ringing' && m.sender === partnerId);
      if (ringingInvite && syncUpdateMessage) {
        syncUpdateMessage(ringingInvite.id, { status: 'accepted' });
      }
    } catch (err) {
      console.error("[WebRTC] Failed to accept call:", err);
      if (err.name === 'NotAllowedError') toast?.('Camera/Mic permission denied', 'error');
      endCall(true);
    }
  }, [incomingCall, sfxEnabled, syncedRoomId, myPeerId, chatHistory, partnerId, syncUpdateMessage, toast, endCall]);

  const rejectCall = useCallback(() => {
    playAudio('click', sfxEnabled);
    
    // Signaling: Broadcast end
    const channel = supabase.channel(`room_${syncedRoomId}`);
    channel.send({
      type: 'broadcast',
      event: 'call_signal',
      payload: { action: 'ended' }
    });

    // Update chat message
    const ringingInvite = chatHistory?.find(m => m.type === 'call_invite' && m.status === 'ringing');
    if (ringingInvite && syncUpdateMessage) {
      syncUpdateMessage(ringingInvite.id, { status: 'rejected' });
    }
    
    setIncomingCall(null);
    setIsRinging(false);
  }, [sfxEnabled, syncedRoomId, chatHistory, syncUpdateMessage]);

  // 3. Initiate Peer Call (Strictly for the CALLER)
  const initiatePeerCall = useCallback(async (type, targetPeerId) => {
    if (!peerRef.current || peerRef.current.destroyed) {
      toast?.('Connection not ready. Try again.', 'error');
      return endCall(true);
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: type === 'video' 
      });

      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsRinging(false);

      console.log(`[WebRTC] Dialing partner: ${targetPeerId}`);
      const call = peerRef.current.call(targetPeerId, stream);
      currentCallRef.current = call;

      call.on('stream', (rs) => {
        console.log("[WebRTC] Remote stream received (Caller side)");
        setRemoteStream(rs);
      });

      call.on('close', () => endCall());
      call.on('error', () => endCall());

    } catch (err) {
      console.error("[WebRTC] Call initiation failed:", err);
      if (err.name === 'NotAllowedError') toast?.('Camera/Mic permission denied', 'error');
      endCall(true);
    }
  }, [toast, endCall]);

  // 4. Global Signal Listener (Internal to the hook)
  useEffect(() => {
    if (!syncedRoomId || !userId) return;

    const channel = supabase.channel(`room_webrtc_${syncedRoomId}`);
    channel
      .on('broadcast', { event: 'call_signal' }, (payload) => {
        const data = payload.payload;
        console.log(`[WebRTC] Received signal: ${data.action}`, data);

        if (data.action === 'ring' && data.callerPeerId) {
          // I am receiving a ring
          setIncomingCall({ type: data.type, fromName: partnerName, callerPeerId: data.callerPeerId });
          setIsRinging(true);
          if (!ringingIntervalRef.current) {
            ringingIntervalRef.current = setInterval(() => playAudio('receive', sfxEnabled), 1200);
          }
        } 
        else if (data.action === 'answered') {
          // My partner answered!
          if (calling && !currentCallRef.current) {
            console.log("[WebRTC] Partner answered. Initiating PeerJS dial...");
            initiatePeerCall(calling, data.answererPeerId);
          }
        } 
        else if (data.action === 'ended') {
          // Call was ended or rejected
          endCall(true);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [syncedRoomId, userId, partnerName, calling, initiatePeerCall, endCall, sfxEnabled]);

  // 5. Call Timer
  useEffect(() => {
    if (calling && !isRinging) {
      callTimerRef.current = setInterval(() => setCallDuration(p => p + 1), 1000);
    } else {
      setCallDuration(0);
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    }
    return () => { if (callTimerRef.current) clearInterval(callTimerRef.current); };
  }, [calling, isRinging]);

  // 6. Controls
  const toggleMic = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => t.enabled = !t.enabled);
      setIsMuted(!localStreamRef.current.getAudioTracks()[0].enabled);
    }
  };

  const toggleCamera = () => {
    if (localStreamRef.current && calling === 'video') {
      localStreamRef.current.getVideoTracks().forEach(t => t.enabled = !t.enabled);
      setIsCameraOff(!localStreamRef.current.getVideoTracks()[0].enabled);
    }
  };

  const toggleDeafen = () => {
    setIsDeafened(!isDeafened);
    // In a real app, you'd mute the <video> element based on this state
  };

  return {
    calling,
    isRinging,
    incomingCall,
    callDuration,
    remoteStream,
    localStream,
    isMuted,
    isDeafened,
    isCameraOff,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMic,
    toggleCamera,
    toggleDeafen,
    myPeerId
  };
}
