import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import Peer from 'peerjs';
import { supabase } from '../lib/supabase.js';
import { useAuth } from './AuthContext.jsx';
import { playAudio } from '../utils/audio.js';

const CallContext = createContext(null);

export function CallProvider({ children }) {
  const { userId, partnerId, roomId } = useAuth();
  const [calling, setCalling] = useState(null); // 'audio', 'video', or null
  const [isRinging, setIsRinging] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const [remoteStream, setRemoteStream] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  
  const peerRef = useRef(null);
  const currentCallRef = useRef(null);
  const dataConnRef = useRef(null);
  const localStreamRef = useRef(null);
  const tabIdRef = useRef(Math.random().toString(36).substring(2, 8));
  const myPeerId = userId ? `${userId}-${tabIdRef.current}` : null;

  const cleanupCall = useCallback(() => {
    setCalling(null);
    setIsRinging(false);
    setIncomingCall(null);
    setRemoteStream(null);
    setCallDuration(0);
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }
    if (currentCallRef.current) {
      currentCallRef.current.close();
      currentCallRef.current = null;
    }
  }, []);

  // 1. Initialize PeerJS
  useEffect(() => {
    if (!userId || !myPeerId) return;

    let retryCount = 0;
    let mounted = true;
    let retryTimeout = null;

    const initPeer = () => {
      if (peerRef.current && !peerRef.current.destroyed) {
        console.log("[CallContext] Destroying existing peer before re-init");
        peerRef.current.destroy();
      }

      console.log(`[CallContext] Initializing Peer with ID: ${myPeerId}`);
      try {
        const peer = new Peer(myPeerId, {
          debug: 1,
          config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
        });

        peerRef.current = peer;

        peer.on('open', (id) => {
          console.log(`[CallContext] Peer open: ${id}`);
          retryCount = 0;
        });

        peer.on('disconnected', () => {
          console.warn('[CallContext] Peer disconnected from server, reconnecting...');
          if (mounted && !peer.destroyed) {
             peer.reconnect();
          }
        });

        peer.on('connection', (conn) => {
          console.log(`[CallContext] Incoming Data Connection from ${conn.peer}`);
          dataConnRef.current = conn;
          setupDataListeners(conn);
        });

        peer.on('call', async (call) => {
          console.log(`[CallContext] Incoming Call from ${call.peer}`);
          currentCallRef.current = call;

          call.on('stream', (rs) => setRemoteStream(rs));
          call.on('close', () => cleanupCall());

          // If this tab was already calling/ringing, answer directly with its stream
          if (calling || isRinging) {
            let stream = localStreamRef.current;
            if (!stream) {
              try {
                stream = await navigator.mediaDevices.getUserMedia({
                  audio: true,
                  video: call.metadata?.type === 'video'
                });
                localStreamRef.current = stream;
                setLocalStream(stream);
              } catch (e) {
                console.error("[CallContext] Error getting media stream for incoming call", e);
              }
            }
            if (stream) {
              call.answer(stream);
              setCalling(call.metadata?.type || 'audio');
              setIsRinging(false);
            }
          } else {
            setIncomingCall({ type: call.metadata?.type || 'audio', callerPeerId: call.peer });
            setIsRinging(true);
          }
        });

        peer.on('error', (err) => {
          console.error('[CallContext] Peer Error:', err);
          
          const fatalErrors = ['network', 'server-error', 'socket-error'];
          if (fatalErrors.includes(err.type) && mounted && retryCount < 5) {
            retryCount++;
            console.log(`[CallContext] Fatal peer error, retrying in 3s... (Attempt ${retryCount})`);
            if (retryTimeout) clearTimeout(retryTimeout);
            retryTimeout = setTimeout(initPeer, 3000);
          }
        });
      } catch (err) {
        console.error("[CallContext] Peer creation failed:", err);
      }
    };

    initPeer();

    return () => {
      mounted = false;
      if (retryTimeout) clearTimeout(retryTimeout);
      if (peerRef.current) {
        console.log("[CallContext] Component unmounting, destroying peer.");
        const p = peerRef.current;
        peerRef.current = null;
        p.destroy();
      }
    };
  }, [userId, myPeerId, calling, isRinging, cleanupCall]);

  const callChannelRef = useRef(null);

  // Supabase fallback signaling listeners
  useEffect(() => {
    if (!roomId || !userId) return;
    const channelId = `room_call_${roomId}`;
    console.log(`[CallContext] Creating channel for signaling: ${channelId}`);

    const channel = supabase.channel(channelId);
    callChannelRef.current = channel;

    channel.on('broadcast', { event: 'call_signal' }, ({ payload }) => {
      console.log('[CallContext] Received call_signal broadcast:', payload);
      if (payload.action === 'ring' && payload.callerPeerId !== myPeerId) {
        setIncomingCall({ type: payload.type, callerPeerId: payload.callerPeerId });
        setIsRinging(true);
      } else if (payload.action === 'ended') {
        cleanupCall();
      } else if (payload.action === 'upgrade') {
        console.log(`[CallContext] Upgrade received:`, payload);
        setCalling(payload.type);
        setIsCameraOff(false);
      } else if (payload.action === 'accepted' && payload.receiverPeerId !== myPeerId) {
        setIsRinging(false);
        setCalling(payload.type || calling || 'audio');
      }
    }).subscribe((status) => {
      console.log(`[CallContext] Channel ${channelId} status: ${status}`);
    });

    return () => {
      console.log(`[CallContext] Unsubscribing channel: ${channelId}`);
      channel.unsubscribe();
      callChannelRef.current = null;
    };
  }, [roomId, userId, myPeerId, calling, partnerId, cleanupCall]);

  const setupDataListeners = (conn) => {
    conn.on('data', (data) => {
      console.log('[CallContext] Data Received:', data);
      window.dispatchEvent(new CustomEvent('webrtc_data', { detail: data }));
    });
    conn.on('close', () => { dataConnRef.current = null; });
  };

  const startCall = async (type) => {
    if (!partnerId) return;
    setCalling(type);
    setIsRinging(true);
    setIsCameraOff(type === 'audio');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === 'video'
      });
      localStreamRef.current = stream;
      setLocalStream(stream);

      if (callChannelRef.current) {
        console.log('[CallContext] Broadcasting ring action');
        callChannelRef.current.send({
          type: 'broadcast',
          event: 'call_signal',
          payload: { action: 'ring', callerPeerId: myPeerId, type }
        });
      }
    } catch (e) {
      console.error("[CallContext] Failed to access local stream:", e);
      cleanupCall();
    }
  };

  const acceptCall = async () => {
    if (!incomingCall) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: incomingCall.type === 'video'
      });
      localStreamRef.current = stream;
      setLocalStream(stream);

      setCalling(incomingCall.type);
      setIsRinging(false);
      setIncomingCall(null);

      // Directly make the PeerJS call to the caller
      if (peerRef.current && incomingCall.callerPeerId) {
        console.log(`[CallContext] Directly calling peer back: ${incomingCall.callerPeerId}`);
        const call = peerRef.current.call(incomingCall.callerPeerId, stream, { metadata: { type: incomingCall.type } });
        currentCallRef.current = call;
        call.on('stream', (rs) => setRemoteStream(rs));
        call.on('close', () => cleanupCall());
      }
      // Also broadcast the accepted signal so the other side updates its UI immediately
      if (callChannelRef.current) {
        console.log('[CallContext] Broadcasting accepted action');
        callChannelRef.current.send({
          type: 'broadcast',
          event: 'call_signal',
          payload: { action: 'accepted', receiverPeerId: myPeerId, type: incomingCall.type }
        });
      }
    } catch (err) {
      console.error('[CallContext] Failed to accept call:', err);
      cleanupCall();
    }
  };

  const endCall = () => {
    cleanupCall();
    if (callChannelRef.current) {
        console.log('[CallContext] Broadcasting ended action');
        callChannelRef.current.send({
            type: 'broadcast',
            event: 'call_signal',
            payload: { action: 'ended' }
        });
    }
  };

  const toggleMic = () => {
    setIsMuted(prev => {
      const next = !prev;
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach(track => {
          track.enabled = !next;
        });
      }
      return next;
    });
  };

  const toggleCamera = async () => {
    setIsCameraOff(prev => {
      const next = !prev;
      if (!next) {
        // We are turning the camera ON
        if (calling === 'audio') {
          setCalling('video');
          // Obtain video tracks from mediaDevices
          navigator.mediaDevices.getUserMedia({ video: true }).then(vs => {
            const vt = vs.getVideoTracks()[0];
            if (vt && localStreamRef.current) {
              localStreamRef.current.addTrack(vt);
              if (currentCallRef.current && currentCallRef.current.peerConnection) {
                const senders = currentCallRef.current.peerConnection.getSenders();
                const videoSender = senders.find(s => s.track && s.track.kind === 'video');
                if (videoSender) {
                  videoSender.replaceTrack(vt);
                } else {
                  currentCallRef.current.peerConnection.addTrack(vt, localStreamRef.current);
                }
              }
            }
          }).catch(err => {
            console.error('[CallContext] Failed to add video track on toggle:', err);
          });
          if (callChannelRef.current) {
            console.log('[CallContext] Broadcasting upgrade action');
            callChannelRef.current.send({
              type: 'broadcast',
              event: 'call_signal',
              payload: { action: 'upgrade', type: 'video' }
            });
          }
        } else if (localStreamRef.current) {
          localStreamRef.current.getVideoTracks().forEach(track => {
            track.enabled = true;
          });
        }
      } else {
        // Turning camera OFF
        if (localStreamRef.current) {
          localStreamRef.current.getVideoTracks().forEach(track => {
            track.enabled = false;
          });
        }
      }
      return next;
    });
  };

  const toggleDeafen = () => {
    setIsDeafened(prev => !prev);
  };

  const sendData = (data) => {
    if (dataConnRef.current && dataConnRef.current.open) {
      dataConnRef.current.send(data);
      return true;
    }
    return false;
  };

  const value = {
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
    endCall,
    toggleMic,
    toggleCamera,
    toggleDeafen,
    sendData,
    myPeerId
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCall() {
  const context = useContext(CallContext);
  if (!context) throw new Error('useCall must be used within a CallProvider');
  return context;
}
