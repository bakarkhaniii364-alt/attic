import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import localforage from 'localforage';
import { supabase } from '../lib/supabase.js';
import { useAuth, useSync } from './instances.js';
import { isTestMode, sendTestStateUpdate, onTestStateUpdate } from '../lib/testMode.js';
import { ChatContext } from './instances.js';
import { 
  generateECDHKeypair, 
  exportPublicKeyJWK, 
  importPublicKeyJWK, 
  deriveSharedKey, 
  encryptText, 
  decryptText, 
  generateFileKey, 
  encryptFile, 
  decryptFile, 
  encryptFileMetadata, 
  decryptFileMetadata, 
  getLocalKeypair, 
  saveLocalKeypair 
} from '../utils/crypto.js';

const CACHE_VERSION = 'v6'; // Bumped for raw DB cache and E2EE support

const decryptedMediaCache = new Map();

/**
 * Downloads and decrypts encrypted media files from Supabase Storage.
 */
async function getOrDecryptMedia(row, sharedKey) {
  if (decryptedMediaCache.has(row.id)) {
    return decryptedMediaCache.get(row.id);
  }
  try {
    const meta = row.metadata?.encrypted_media_meta;
    if (!meta) return '';

    // Decrypt the file key and iv
    const { fileKey, fileIv } = await decryptFileMetadata(meta.ciphertext, meta.iv, sharedKey);

    // Download the encrypted file
    const parts = row.content.split('/');
    const bucket = parts[0];
    const path = parts.slice(1).join('/');

    const { data: encryptedBlob, error: downloadError } = await supabase.storage.from(bucket).download(path);
    if (downloadError) throw downloadError;

    // Decrypt the file blob
    const mimeType = row.metadata?.mimeType || 'application/octet-stream';
    const decryptedBlob = await decryptFile(encryptedBlob, fileKey, fileIv, mimeType);

    // Create a local URL
    const url = URL.createObjectURL(decryptedBlob);
    decryptedMediaCache.set(row.id, url);
    return url;
  } catch (err) {
    console.error('[E2EE] Media decryption failed:', err);
    return '';
  }
}

export function ChatProvider({ children }) {
  const { roomId, userId, partnerId } = useAuth();
  const sync = useSync();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const rawContentMapRef = useRef(new Map());

  // E2EE States
  const [sharedKey, setSharedKey] = useState(null);
  const sharedKeyRef = useRef(null);

  // Sync Room Profiles for Public Keys
  const roomProfiles = sync?.globalState?.room_profiles || {};
  const myPubJwkStr = JSON.stringify(roomProfiles[userId]?.e2ee_public_key || null);
  const partnerPubJwkStr = JSON.stringify(roomProfiles[partnerId]?.e2ee_public_key || null);

  // Initialize E2EE Cryptography & Exchange Keys
  useEffect(() => {
    if (!userId || !roomId) {
      setSharedKey(null);
      return;
    }

    let isCurrent = true;

    const initE2EE = async () => {
      try {
        // 1. Get or generate local ECDH keypair
        let keys = await getLocalKeypair(userId);
        if (!keys) {
          keys = await generateECDHKeypair();
          await saveLocalKeypair(userId, keys);
        }

        if (!isCurrent) return;

        // 2. Export and publish local public key if not already matching in sync state
        const localPubJwk = await exportPublicKeyJWK(keys.publicKey);
        const myProfile = roomProfiles[userId] || {};
        const myPubJwkStrLoc = myProfile.e2ee_public_key ? JSON.stringify(myProfile.e2ee_public_key) : null;
        const localPubJwkStr = JSON.stringify(localPubJwk);

        if (myPubJwkStrLoc !== localPubJwkStr) {
          await sync.updateSyncStateAtomic('room_profiles', userId, {
            e2ee_public_key: localPubJwk
          });
        }

        // 3. Derive shared key if partner public key is available
        if (partnerId) {
          const partnerProfile = roomProfiles[partnerId] || {};
          const partnerPubJwk = partnerProfile.e2ee_public_key;
          if (partnerPubJwk) {
            const partnerPubKey = await importPublicKeyJWK(partnerPubJwk);
            const derived = await deriveSharedKey(keys.privateKey, partnerPubKey);
            if (isCurrent) {
              setSharedKey(derived);
            }
          } else {
            if (isCurrent) setSharedKey(null);
          }
        }
      } catch (err) {
        console.error('[E2EE] Init failed:', err);
      }
    };

    initE2EE();

    return () => {
      isCurrent = false;
    };
  }, [userId, roomId, partnerId, myPubJwkStr, partnerPubJwkStr]);

  // Keep sharedKeyRef synchronized for real-time listeners and callbacks
  useEffect(() => {
    sharedKeyRef.current = sharedKey;
  }, [sharedKey]);

  /**
   * Maps a database row into an application message object.
   * Decrypts content on-the-fly if encrypted.
   */
  const mapMessage = useCallback(async (row) => {
    const isTemp = String(row.id).startsWith('temp-');
    const isEncrypted = !!row.metadata?.is_encrypted && !isTemp;
    const currentSharedKey = sharedKeyRef.current;

    const mapped = {
      ...row,
      sender: row.sender_id,
      time: new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      replyTo: row.metadata?.replyTo || null,
      reactions: row.metadata?.reactions || [],
      isDeleted: row.metadata?.isDeleted || false,
      isEdited: row.metadata?.isEdited || false,
      duration: row.metadata?.duration || null,
      status: row.metadata?.status || 'sent',
      readAt: row.metadata?.readAt || null,
      fileName: row.metadata?.fileName || null,
      fileSize: row.metadata?.fileSize || null,
      clientId: row.metadata?.client_id || null
    };

    if (row.type === 'text') {
      if (isEncrypted) {
        if (currentSharedKey) {
          try {
            mapped.text = await decryptText(row.content, row.metadata.iv, currentSharedKey);
          } catch (e) {
            console.error('[E2EE] Decrypt text failed:', e);
            mapped.text = '🔒 Encrypted Message (Decryption failed)';
          }
        } else {
          mapped.text = '🔒 Encrypted Message';
        }
      } else {
        mapped.text = row.content || '';
        if (row.content && row.content.includes('"ciphertext"')) {
          mapped.text = '[Legacy Encrypted Message]';
        }
      }
    } else if (row.type === 'image') {
      if (isEncrypted) {
        if (currentSharedKey) {
          mapped.url = await getOrDecryptMedia(row, currentSharedKey);
        } else {
          mapped.url = '';
          mapped.isMediaLocked = true;
        }
      } else {
        mapped.url = row.content;
      }
    } else if (row.type === 'voice') {
      if (isEncrypted) {
        if (currentSharedKey) {
          mapped.audioUrl = await getOrDecryptMedia(row, currentSharedKey);
        } else {
          mapped.audioUrl = '';
          mapped.isMediaLocked = true;
        }
      } else {
        mapped.audioUrl = row.content;
      }
    } else if (row.type === 'video' || row.type === 'audio' || row.type === 'file') {
      if (isEncrypted) {
        if (currentSharedKey) {
          mapped.url = await getOrDecryptMedia(row, currentSharedKey);
        } else {
          mapped.url = '';
          mapped.isMediaLocked = true;
        }
      } else {
        mapped.url = row.content;
      }
    } else if (row.type === 'game_invite') {
      mapped.text = row.content;
      mapped.gameId = row.metadata?.gameId;
      mapped.gameTitle = row.metadata?.gameTitle;
      mapped.status = row.metadata?.status;
    } else if (row.type === 'call_invite') {
      mapped.callType = row.metadata?.callType || 'voice';
      mapped.status = row.metadata?.status || 'accepted';
    }

    return mapped;
  }, []);

  // Main Chat Initialization and Realtime Subscriptions
  useEffect(() => {
    if (!roomId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    let mounted = true;
    const rawCacheKey = `chat_raw_cache_${roomId}_${CACHE_VERSION}`;

    const updateRawCache = async (eventType, row) => {
      try {
        const cached = await localforage.getItem(rawCacheKey) || [];
        let nextRaw = [...cached];
        if (eventType === 'INSERT') {
          if (!nextRaw.some(r => r.id === row.id)) {
            nextRaw = [row, ...nextRaw].slice(0, 50);
          }
        } else if (eventType === 'UPDATE') {
          nextRaw = nextRaw.map(r => r.id === row.id ? row : r);
        } else if (eventType === 'DELETE') {
          nextRaw = nextRaw.filter(r => r.id !== row.id);
        }
        await localforage.setItem(rawCacheKey, nextRaw);
      } catch (err) {
        console.warn('[CHAT] Cache update failed:', err);
      }
    };

    const initChat = async () => {
      if (isTestMode()) {
        setLoading(false);
        return;
      }

      // Load raw cached rows first and map them
      const cachedRaw = await localforage.getItem(rawCacheKey);
      if (cachedRaw && mounted) {
        const resolvedData = await Promise.all(cachedRaw.map(row => mapMessage(row)));
        const sortedData = resolvedData.reverse();
        setMessages(sortedData);
        setLoading(false);
      }

      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('[CHAT] Fetch error:', error);
        if (mounted) setLoading(false);
        return;
      }

      if (data && mounted) {
        await localforage.setItem(rawCacheKey, data);
        const resolvedData = await Promise.all(data.map(row => mapMessage(row)));
        const sortedData = resolvedData.reverse();
        setMessages(sortedData);
        setLoading(false);
        setHasMore(data.length === 50);
      }
    };

    initChat();

    let channel = null;
    let unsubs = [];

    if (isTestMode()) {
      unsubs.push(onTestStateUpdate('chat_message', (payload) => {
        mapMessage(payload).then(mapped => {
          if (!mounted) return;
          setMessages(prev => {
            if (prev.some(m => m.id === mapped.id)) return prev;
            return [...prev, mapped];
          });
        });
      }));

      unsubs.push(onTestStateUpdate('chat_message_update', (payload) => {
        mapMessage(payload).then(mapped => {
          if (!mounted) return;
          setMessages(prev => prev.map(m => m.id === mapped.id ? mapped : m));
        });
      }));
    } else {
      channel = supabase.channel(`chat_realtime_${roomId}_${CACHE_VERSION}`);
      channel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${roomId}` }, (payload) => {
          if (payload.eventType === 'INSERT') {
            updateRawCache('INSERT', payload.new);
            mapMessage(payload.new).then(mapped => {
              if (!mounted) return;
              setMessages(prev => {
                if (prev.some(m => m.id === mapped.id)) return prev;
                
                const clientId = mapped.clientId;
                if (clientId && prev.some(m => String(m.id).startsWith('temp-') && m.clientId === clientId)) {
                  return prev.map(m => (String(m.id).startsWith('temp-') && m.clientId === clientId) ? mapped : m);
                }

                return [...prev, mapped];
              });
            });
          } else if (payload.eventType === 'UPDATE') {
            updateRawCache('UPDATE', payload.new);
            mapMessage(payload.new).then(mapped => {
              if (!mounted) return;
              setMessages(prev => prev.map(m => m.id === mapped.id ? mapped : m));
            });
          } else if (payload.eventType === 'DELETE') {
            updateRawCache('DELETE', payload.old);
            if (mounted) setMessages(prev => prev.filter(m => m.id !== payload.old.id));
          }
        })
        .subscribe();
    }

    return () => {
      mounted = false;
      if (channel) supabase.removeChannel(channel);
      unsubs.forEach(un => un());
    };
  }, [roomId, sharedKey, mapMessage]); // Re-subscribe and refresh when sharedKey becomes available

  const { broadcast } = sync || {};

  /**
   * Encrypts and sends a chat message.
   */
  const sendMessage = useCallback(async (content, type = 'text', metadata = {}) => {
    const meta = (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) ? metadata : {};

    if (!roomId || !userId) {
      console.error('[CHAT] sendMessage called before auth ready:', { roomId, userId });
      return;
    }
    if (!content && type === 'text') {
      console.warn('[CHAT] Refusing empty text message');
      return;
    }

    const tempId = `temp-${crypto.randomUUID()}`;
    const clientId = crypto.randomUUID();
    const optimisticContent = (content instanceof Blob || content instanceof File) ? URL.createObjectURL(content) : content;

    const optimisticMsg = {
      id: tempId,
      room_id: roomId,
      sender_id: userId,
      type,
      content: optimisticContent,
      metadata: { ...meta, status: 'sending', client_id: clientId },
      created_at: new Date().toISOString()
    };

    const mappedOptimistic = await mapMessage(optimisticMsg);
    mappedOptimistic.clientId = clientId;
    
    if (content instanceof Blob || content instanceof File) {
      rawContentMapRef.current.set(clientId, content);
    }
    
    setMessages(prev => [...prev, mappedOptimistic]);

    if (isTestMode()) {
      sendTestStateUpdate('chat_message', optimisticMsg);
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'sent' } : m));
      return optimisticMsg;
    }

    try {
      let finalContent = content;
      let finalMetadata = { ...meta, client_id: clientId };
      const currentSharedKey = sharedKeyRef.current;

      if (currentSharedKey) {
        if (type === 'text') {
          const encrypted = await encryptText(content, currentSharedKey);
          finalContent = encrypted.ciphertext;
          finalMetadata.iv = encrypted.iv;
          finalMetadata.is_encrypted = true;
        } else if (content instanceof Blob || content instanceof File) {
          // Encrypt file content with a randomized key
          const fileKey = await generateFileKey();
          const fileIv = window.crypto.getRandomValues(new Uint8Array(12));
          const encryptedBlob = await encryptFile(content, fileKey, fileIv);

          const fileExt = content.name?.split('.').pop() || content.type.split('/')[1]?.split(';')[0] || 'bin';
          const bucket = (type === 'voice' || type === 'audio') ? 'voice_notes' : 'scrapbook';
          const fileName = `${roomId}/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

          const { error: uploadError } = await supabase.storage.from(bucket).upload(fileName, encryptedBlob);
          if (uploadError) throw uploadError;

          finalContent = `${bucket}/${fileName}`;
          
          // Encrypt fileKey metadata with shared ECDH key
          const encryptedMeta = await encryptFileMetadata(fileKey, fileIv, currentSharedKey);
          
          finalMetadata.encrypted_media_meta = encryptedMeta;
          finalMetadata.is_encrypted = true;
          finalMetadata.mimeType = content.type;
          
          if (content.name && !meta.fileName) finalMetadata.fileName = content.name;
          if (content.size && !meta.fileSize) finalMetadata.fileSize = content.size;
        }
      } else {
        console.warn('[E2EE] Sending unencrypted message (no shared key derived yet)');
        if (content instanceof Blob || content instanceof File) {
          const fileExt = content.name?.split('.').pop() || content.type.split('/')[1]?.split(';')[0] || 'bin';
          const bucket = (type === 'voice' || type === 'audio') ? 'voice_notes' : 'scrapbook';
          const fileName = `${roomId}/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

          const { error: uploadError } = await supabase.storage.from(bucket).upload(fileName, content);
          if (uploadError) throw uploadError;

          finalContent = `${bucket}/${fileName}`;
          if (content.name && !meta.fileName) finalMetadata.fileName = content.name;
          if (content.size && !meta.fileSize) finalMetadata.fileSize = content.size;
        }
      }

      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          room_id: roomId,
          sender_id: userId,
          type,
          content: finalContent,
          metadata: { ...finalMetadata, status: 'sent' }
        })
        .select()
        .single();

      if (error) throw error;

      if (broadcast) {
        broadcast('chat_message', { sender: userId, type });
      }

      if (data && data.id) {
        const mapped = await mapMessage(data);
        if (clientId) {
          rawContentMapRef.current.delete(clientId);
        }
        setMessages(prev => {
          if (!prev.some(m => String(m.id).startsWith('temp-') && m.clientId === clientId)) {
             if (prev.some(m => m.id === mapped.id)) return prev;
             return [...prev, mapped];
          }
          return prev.map(m => (String(m.id).startsWith('temp-') && m.clientId === clientId) ? mapped : m);
        });

        // Update local raw cache
        const rawCacheKey = `chat_raw_cache_${roomId}_${CACHE_VERSION}`;
        const cached = await localforage.getItem(rawCacheKey) || [];
        if (!cached.some(r => r.id === data.id)) {
          const nextRaw = [data, ...cached].slice(0, 50);
          await localforage.setItem(rawCacheKey, nextRaw);
        }
      } else {
        if (clientId) {
          rawContentMapRef.current.delete(clientId);
        }
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'sent' } : m));
      }
    } catch (err) {
      console.error('[CHAT] Send error:', err);
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m));
    }
  }, [roomId, userId, broadcast, mapMessage]);

  const updateMessage = useCallback(async (idOrIds, updates) => {
    if (!idOrIds) return;
    const isArray = Array.isArray(idOrIds);
    if (isArray && idOrIds.length === 0) return;

    let query = supabase.from('chat_messages').update({ metadata: updates });
    if (isArray) {
      query = query.in('id', idOrIds);
    } else {
      query = query.eq('id', idOrIds);
    }
    const { error } = await query;
    if (error) console.error('[CHAT] Update error:', error);
  }, []);

  const deleteMessage = useCallback(async (id) => {
    if (!id) return;
    const { error } = await supabase.from('chat_messages').delete().eq('id', id);
    if (error) console.error('[CHAT] Delete error:', error);
  }, []);

  const loadMore = useCallback(async () => {
    if (!roomId || !hasMore || loading) return;
    const oldestMsg = messages[0];
    if (!oldestMsg) return;

    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('room_id', roomId)
      .lt('created_at', oldestMsg.created_at)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[CHAT] Load more error:', error);
      return;
    }

    if (data) {
      const resolvedData = await Promise.all(data.map(row => mapMessage(row)));
      const sortedData = resolvedData.reverse();
      setMessages(prev => [...sortedData, ...prev]);
      setHasMore(data.length === 50);
    }
  }, [roomId, hasMore, loading, messages, mapMessage]);

  const resetToLatest = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (data) {
      const resolvedData = await Promise.all(data.map(row => mapMessage(row)));
      const sortedData = resolvedData.reverse();
      setMessages(sortedData);
      setHasMore(data.length === 50);
    }
    setLoading(false);
  }, [roomId, mapMessage]);

  const searchMessages = useCallback(async (query, page = 0, limit = 20) => {
    if (!roomId || !query) return { data: [], hasMore: false };
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('room_id', roomId)
      .textSearch('content', query, { type: 'websearch', config: 'english' })
      .order('created_at', { ascending: false })
      .range(page * limit, (page + 1) * limit - 1);
      
    if (error) {
      console.error('[CHAT] Search error:', error);
      return { data: [], hasMore: false };
    }
    const resolvedData = await Promise.all(data.map(row => mapMessage(row)));
    return { data: resolvedData, hasMore: data.length === limit };
  }, [roomId, mapMessage]);

  const jumpToMessage = useCallback(async (createdAt) => {
    if (!roomId || !createdAt) return [];
    setLoading(true);
    
    const { data: before } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('room_id', roomId)
      .lte('created_at', createdAt)
      .order('created_at', { ascending: false })
      .limit(25);
      
    const { data: after } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('room_id', roomId)
      .gt('created_at', createdAt)
      .order('created_at', { ascending: true })
      .limit(25);
      
    const combined = [...(before || []).reverse(), ...(after || [])];
    const resolvedData = await Promise.all(combined.map(row => mapMessage(row)));
    setMessages(resolvedData);
    setHasMore((before || []).length === 25);
    setLoading(false);
    return resolvedData;
  }, [roomId, mapMessage]);

  const loadNewer = useCallback(async () => {
    if (!roomId || loading) return;
    const newestMsg = messages[messages.length - 1];
    if (!newestMsg) return;
    
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('room_id', roomId)
      .gt('created_at', newestMsg.created_at)
      .order('created_at', { ascending: true })
      .limit(50);
      
    if (data && data.length > 0) {
      const resolvedData = await Promise.all(data.map(row => mapMessage(row)));
      setMessages(prev => [...prev, ...resolvedData]);
    }
  }, [roomId, loading, messages, mapMessage]);

  const retrySendMessage = useCallback(async (msg) => {
    if (!msg || !msg.id) return;
    setMessages(prev => prev.filter(m => m.id !== msg.id));
    const clientId = msg.clientId;
    let originalContent = msg.content;
    if (clientId && rawContentMapRef.current.has(clientId)) {
      originalContent = rawContentMapRef.current.get(clientId);
    }
    const { status, client_id, ...meta } = msg.metadata || {};
    const resendMetadata = {
      ...meta,
      replyTo: msg.replyTo,
      duration: msg.duration,
      fileName: msg.fileName,
      fileSize: msg.fileSize,
      gameId: msg.gameId,
      gameTitle: msg.gameTitle,
      callType: msg.callType
    };
    Object.keys(resendMetadata).forEach(key => {
      if (resendMetadata[key] === undefined || resendMetadata[key] === null) {
        delete resendMetadata[key];
      }
    });
    await sendMessage(originalContent, msg.type, resendMetadata);
    if (clientId) {
      rawContentMapRef.current.delete(clientId);
    }
  }, [sendMessage]);

  const value = { messages, sendMessage, retrySendMessage, updateMessage, deleteMessage, loadMore, loading, hasMore, searchMessages, jumpToMessage, loadNewer, resetToLatest };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
