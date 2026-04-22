import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase.js';

/**
 * Call Manager Hook
 * Manages P2P video/audio calls with persistence across tabs.
 * Uses Supabase realtime as signaling and localStorage for call state.
 */
export function useCallManager(roomId, userId, partnerNickname) {
  const [callActive, setCallActive] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [remoteStream, setRemoteStream] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [callType, setCallType] = useState(null); // 'audio' | 'video'

  const peerConnectionRef = useRef(null);
  const durationIntervalRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  // Initialize ICE servers for WebRTC
  const iceServers = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ];

  // Set up Supabase realtime for signaling
  useEffect(() => {
    if (!roomId || !userId) return;

    const channel = supabase.channel(`call:${roomId}`);

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        // Handle presence updates for call status
      })
      .on('broadcast', { event: 'offer' }, handleOffer)
      .on('broadcast', { event: 'answer' }, handleAnswer)
      .on('broadcast', { event: 'ice-candidate' }, handleIceCandidate)
      .on('broadcast', { event: 'call-end' }, handleCallEnd)
      .subscribe();

    return () => channel.unsubscribe();
  }, [roomId, userId]);

  // Handle incoming offer
  const handleOffer = async (payload) => {
    try {
      if (!peerConnectionRef.current) {
        createPeerConnection();
      }
      await peerConnectionRef.current.setRemoteDescription(
        new RTCSessionDescription(payload.offer)
      );
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);

      // Send answer back
      await supabase.channel(`call:${roomId}`).send({
        type: 'broadcast',
        event: 'answer',
        payload: { answer: peerConnectionRef.current.localDescription, from: userId },
      });
    } catch (err) {
      console.error('Error handling offer:', err);
    }
  };

  // Handle incoming answer
  const handleAnswer = async (payload) => {
    try {
      if (peerConnectionRef.current && payload.answer) {
        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(payload.answer)
        );
      }
    } catch (err) {
      console.error('Error handling answer:', err);
    }
  };

  // Handle ICE candidate
  const handleIceCandidate = async (payload) => {
    try {
      if (peerConnectionRef.current && payload.candidate) {
        await peerConnectionRef.current.addIceCandidate(
          new RTCIceCandidate(payload.candidate)
        );
      }
    } catch (err) {
      console.error('Error adding ICE candidate:', err);
    }
  };

  // Handle call end
  const handleCallEnd = () => {
    endCall();
  };

  // Create and configure peer connection
  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({ iceServers });

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        supabase.channel(`call:${roomId}`).send({
          type: 'broadcast',
          event: 'ice-candidate',
          payload: { candidate: event.candidate, from: userId },
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        endCall();
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  };

  // Start a call
  const startCall = async (type = 'audio') => {
    try {
      const constraints = {
        audio: true,
        video: type === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);

      if (localVideoRef.current && type === 'video') {
        localVideoRef.current.srcObject = stream;
      }

      // Create peer connection and add local stream
      if (!peerConnectionRef.current) {
        createPeerConnection();
      }

      stream.getTracks().forEach((track) => {
        peerConnectionRef.current.addTrack(track, stream);
      });

      // Create and send offer
      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);

      await supabase.channel(`call:${roomId}`).send({
        type: 'broadcast',
        event: 'offer',
        payload: { offer: peerConnectionRef.current.localDescription, from: userId },
      });

      setCallActive(true);
      setCallType(type);

      // Start duration timer
      durationIntervalRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);

      // Save call state to localStorage for persistence
      window.localStorage.setItem(
        `call_state_${roomId}`,
        JSON.stringify({ active: true, type, startTime: Date.now() })
      );
    } catch (err) {
      console.error('Error starting call:', err);
    }
  };

  // End the call
  const endCall = () => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    setCallActive(false);
    setCallDuration(0);
    setRemoteStream(null);
    setCallType(null);

    // Notify partner
    supabase.channel(`call:${roomId}`).send({
      type: 'broadcast',
      event: 'call-end',
      payload: { from: userId },
    });

    // Clear localStorage call state
    window.localStorage.removeItem(`call_state_${roomId}`);
  };

  // Toggle mute
  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  // Toggle deafen (stop receiving audio)
  const toggleDeafen = () => {
    if (remoteStream) {
      remoteStream.getAudioTracks().forEach((track) => {
        track.enabled = track.enabled;
      });
      setIsDeafened(!isDeafened);
    }
  };

  return {
    callActive,
    callDuration,
    isMuted,
    isDeafened,
    remoteStream,
    localStream,
    callType,
    startCall,
    endCall,
    toggleMute,
    toggleDeafen,
    localVideoRef,
    remoteVideoRef,
  };
}
