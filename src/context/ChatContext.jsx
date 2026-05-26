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
  saveLocalKeypair,
  generateRecoveryKey,
  encryptPrivateKey,
  decryptPrivateKey
} from '../utils/crypto.js';
import { RetroWindow, RetroInput, RetroButton, ConfirmDialog, useToast } from '../components/UI.jsx';
import { Lock, Unlock, Key, Copy, Check, Loader, AlertTriangle } from 'lucide-react';


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

  // E2EE Initialization Guards
  const e2eeInitRef = useRef(false); // Tracks if local keys have been initialized this session
  const derivedKeyInputsRef = useRef(null); // Tracks the partner key fingerprint used for last derivation
  const [e2eeVersion, setE2eeVersion] = useState(0); // Incremented to force re-initialization (e.g., after restore)

  // E2EE Backup & Restoration States
  const [recoveryKeyToShow, setRecoveryKeyToShow] = useState(null);
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const [restoreKeyInput, setRestoreKeyInput] = useState('');
  const [restoreError, setRestoreError] = useState(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [hasCopiedRecovery, setHasCopiedRecovery] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const addToast = useToast();

  // Sync Room Profiles for Public Keys
  const roomProfiles = sync?.globalState?.room_profiles || {};
  const myPubJwkX = roomProfiles[userId]?.e2ee_public_key?.x || null;
  const myPubJwkY = roomProfiles[userId]?.e2ee_public_key?.y || null;
  const partnerPubJwkX = roomProfiles[partnerId]?.e2ee_public_key?.x || null;
  const partnerPubJwkY = roomProfiles[partnerId]?.e2ee_public_key?.y || null;
  const isSyncInitialized = sync?.isInitialized;

  // Initialize E2EE Cryptography & Exchange Keys
  useEffect(() => {
    if (!userId || !roomId || !isSyncInitialized) {
      setSharedKey(null);
      e2eeInitRef.current = false;
      derivedKeyInputsRef.current = null;
      return;
    }

    let isCurrent = true;

    const initE2EE = async () => {
      try {
        // --- PHASE 1: Local key initialization (runs once per session) ---
        let keys = await getLocalKeypair(userId);

        if (!e2eeInitRef.current) {
          const myProfile = roomProfiles[userId] || {};
          const backupExists = !!myProfile.encrypted_private_key;

          if (!keys) {
            if (backupExists) {
              // A backup exists on the database. Show the restore prompt.
              if (isCurrent) {
                setShowRestorePrompt(true);
              }
              return; // Halt initialization until restored or reset
            } else {
              // No backup exists. Generate a new key pair and create a backup.
              keys = await generateECDHKeypair();
              await saveLocalKeypair(userId, keys);
              
              const recoveryKey = generateRecoveryKey();
              await localforage.setItem(`e2ee_recovery_key_${userId}`, recoveryKey);
              const encrypted = await encryptPrivateKey(keys.privateKey, recoveryKey);
              const localPubJwk = await exportPublicKeyJWK(keys.publicKey);

              await sync.updateSyncStateAtomic('room_profiles', userId, {
                e2ee_public_key: localPubJwk,
                encrypted_private_key: encrypted
              });

              if (isCurrent) {
                setRecoveryKeyToShow(recoveryKey);
              }
            }
          } else {
            // Keys exist locally. Ensure they're backed up and published.
            const localPubJwk = await exportPublicKeyJWK(keys.publicKey);
            const remotePubKey = myProfile.e2ee_public_key;
            const isSameKey = remotePubKey && 
                              remotePubKey.x === localPubJwk.x && 
                              remotePubKey.y === localPubJwk.y;

            if (!backupExists || !isSameKey) {
              try {
                // Reuse existing recovery key from localforage if available
                let recoveryKey = await localforage.getItem(`e2ee_recovery_key_${userId}`);
                let isNewRecoveryKey = false;
                if (!recoveryKey) {
                  recoveryKey = generateRecoveryKey();
                  await localforage.setItem(`e2ee_recovery_key_${userId}`, recoveryKey);
                  isNewRecoveryKey = true;
                }
                const encrypted = await encryptPrivateKey(keys.privateKey, recoveryKey);
                await sync.updateSyncStateAtomic('room_profiles', userId, {
                  e2ee_public_key: localPubJwk,
                  encrypted_private_key: encrypted
                });
                if (isCurrent && isNewRecoveryKey) {
                  setRecoveryKeyToShow(recoveryKey);
                }
              } catch (err) {
                console.warn('[E2EE] Local key pair is non-extractable (legacy). Publishing public key only.');
                await sync.updateSyncStateAtomic('room_profiles', userId, {
                  e2ee_public_key: localPubJwk
                });
              }
            }
          }

          if (isCurrent) {
            e2eeInitRef.current = true;
          }
        }

        if (!isCurrent) return;

        // --- PHASE 2: Derive shared key (re-runs when partner key changes) ---
        if (!keys) {
          keys = await getLocalKeypair(userId);
        }
        if (!keys) return; // Still no keys (waiting for restore)

        if (partnerId) {
          const partnerProfile = roomProfiles[partnerId] || {};
          const partnerPubJwk = partnerProfile.e2ee_public_key;
          if (partnerPubJwk) {
            // Only re-derive if the partner key inputs actually changed
            const inputFingerprint = `${partnerPubJwk.x}:${partnerPubJwk.y}`;
            if (derivedKeyInputsRef.current === inputFingerprint && sharedKeyRef.current) {
              // Same inputs, skip re-derivation
              return;
            }
            const partnerPubKey = await importPublicKeyJWK(partnerPubJwk);
            const derived = await deriveSharedKey(keys.privateKey, partnerPubKey);
            if (isCurrent) {
              derivedKeyInputsRef.current = inputFingerprint;
              setSharedKey(derived);
            }
          } else {
            if (isCurrent) {
              derivedKeyInputsRef.current = null;
              setSharedKey(null);
            }
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
  }, [userId, roomId, partnerId, isSyncInitialized, myPubJwkX, myPubJwkY, partnerPubJwkX, partnerPubJwkY, e2eeVersion]);

  // Restore/Reset Callbacks
  const handleRestore = useCallback(async (e) => {
    if (e) e.preventDefault();
    if (!restoreKeyInput.trim()) return;

    setIsRestoring(true);
    setRestoreError(null);

    try {
      const myProfile = roomProfiles[userId] || {};
      const encryptedData = myProfile.encrypted_private_key;
      const pubJwk = myProfile.e2ee_public_key;

      if (!encryptedData || !pubJwk) {
        throw new Error('No backup found for this account.');
      }

      const privateKey = await decryptPrivateKey(encryptedData, restoreKeyInput.trim());
      const publicKey = await importPublicKeyJWK(pubJwk);

      const keys = { publicKey, privateKey };
      await saveLocalKeypair(userId, keys);
      await localforage.setItem(`e2ee_recovery_key_${userId}`, restoreKeyInput.trim().toUpperCase());

      addToast('Chat history successfully unlocked!', 'success');
      setShowRestorePrompt(false);
      setRestoreKeyInput('');
      setRestoreError(null);
      // Force re-derivation by resetting guards and bumping version
      e2eeInitRef.current = false;
      derivedKeyInputsRef.current = null;
      setSharedKey(null);
      setE2eeVersion(v => v + 1);
    } catch (err) {
      console.error('[E2EE] Restore failed:', err);
      setRestoreError('Invalid Recovery Key. Please double-check and try again.');
      addToast('Failed to unlock chat history.', 'error');
    } finally {
      setIsRestoring(false);
    }
  }, [userId, roomProfiles, restoreKeyInput, addToast]);

  const handleResetHistory = useCallback(async () => {
    setIsRestoring(true);
    setRestoreError(null);
    setShowResetConfirm(false);

    try {
      const keys = await generateECDHKeypair();
      await saveLocalKeypair(userId, keys);

      const recoveryKey = generateRecoveryKey();
      await localforage.setItem(`e2ee_recovery_key_${userId}`, recoveryKey);
      const encrypted = await encryptPrivateKey(keys.privateKey, recoveryKey);
      const localPubJwk = await exportPublicKeyJWK(keys.publicKey);

      await sync.updateSyncStateAtomic('room_profiles', userId, {
        e2ee_public_key: localPubJwk,
        encrypted_private_key: encrypted
      });

      addToast('Encryption keys reset successfully.', 'success');
      setShowRestorePrompt(false);
      setRestoreKeyInput('');
      setRestoreError(null);
      setRecoveryKeyToShow(recoveryKey);
      // Force re-derivation by resetting guards and bumping version
      e2eeInitRef.current = false;
      derivedKeyInputsRef.current = null;
      setSharedKey(null);
      setE2eeVersion(v => v + 1);
    } catch (err) {
      console.error('[E2EE] Reset failed:', err);
      addToast('Failed to reset encryption keys.', 'error');
    } finally {
      setIsRestoring(false);
    }
  }, [userId, sync, addToast]);

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
            console.warn('[E2EE] Decrypt text failed (probably encrypted with a different key):', e.message);
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

    // Supabase JS update replaces JSONB. We must merge it manually.
    // Fetch the existing message(s) first.
    const { data: existingRows } = await supabase
      .from('chat_messages')
      .select('*')
      .filter('id', isArray ? 'in' : 'eq', isArray ? `(${idOrIds.join(',')})` : idOrIds);
      
    if (!existingRows || existingRows.length === 0) return;

    for (const row of existingRows) {
      let finalContent = row.content;
      const mergedMetadata = { ...(row.metadata || {}), ...updates };
      
      // If we are updating the text content
      if (updates.text !== undefined) {
        finalContent = updates.text;
        delete mergedMetadata.text; // Text doesn't belong in metadata
        
        const currentSharedKey = sharedKeyRef.current;
        if (currentSharedKey) {
          try {
            const encrypted = await encryptText(finalContent, currentSharedKey);
            finalContent = encrypted.ciphertext;
            mergedMetadata.iv = encrypted.iv;
            mergedMetadata.is_encrypted = true;
          } catch (e) {
            console.error('[CHAT] Encryption failed during update:', e);
          }
        } else {
          mergedMetadata.is_encrypted = false;
        }
      }

      const { error } = await supabase
        .from('chat_messages')
        .update({ content: finalContent, metadata: mergedMetadata })
        .eq('id', row.id);
        
      if (error) console.error('[CHAT] Update error:', error);
    }
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

  const value = { messages, sendMessage, retrySendMessage, updateMessage, deleteMessage, loadMore, loading, hasMore, searchMessages, jumpToMessage, loadNewer, resetToLatest, resetE2EEKeys: handleResetHistory };

  return (
    <ChatContext.Provider value={value}>
      {children}

      {/* 1. Recovery Key Setup/Generated Modal */}
      {recoveryKeyToShow && (
        <div className="fixed inset-0 z-[var(--z-modal)] bg-black/40 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <RetroWindow 
            title="e2ee_backup_setup.exe" 
            className="w-full max-w-md shadow-2xl scale-up-15"
            onClose={() => {
              if (hasCopiedRecovery) {
                setRecoveryKeyToShow(null);
                setHasCopiedRecovery(false);
              } else {
                addToast("Please confirm you have saved your Recovery Key.", "warn");
              }
            }}
          >
            <div className="flex flex-col gap-5 py-2 text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2 animate-pulse">
                <Lock size={32} className="text-primary" />
              </div>
              <h1 className="text-xl font-black lowercase text-primary">Chat Encryption Active! 🔐</h1>
              <p className="font-bold text-muted-text text-sm">
                Attic uses End-to-End Encryption. Save this Recovery Key to prevent losing access to your chat history if you log in on another device or clear your browser.
              </p>

              <div className="bg-accent/20 border-2 border-border p-5 text-center space-y-3 relative overflow-hidden select-all">
                <div className="text-[10px] font-black uppercase tracking-widest text-muted-text">Your E2EE Recovery Key</div>
                <div className="text-2xl font-black tracking-tighter text-primary">{recoveryKeyToShow}</div>
                <button 
                  type="button" 
                  onClick={() => { 
                    navigator.clipboard.writeText(recoveryKeyToShow); 
                    addToast("Recovery Key copied!", "success"); 
                  }} 
                  className="text-[9px] font-black uppercase text-primary hover:opacity-70 flex items-center justify-center gap-1 mx-auto border-b border-current"
                >
                  <Copy size={10} /> copy key
                </button>
              </div>

              <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/30 p-3 rounded text-left text-xs font-bold text-amber-800">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span>
                  Keep this key safe. Nobody, including the Attic team, can recover this key or restore your chat history if it is lost.
                </span>
              </div>

              <label className="flex items-center gap-2 cursor-pointer group mt-2 text-left">
                <input 
                  type="checkbox" 
                  checked={hasCopiedRecovery}
                  onChange={e => setHasCopiedRecovery(e.target.checked)}
                  className="w-4 h-4 border-2 border-border accent-primary cursor-pointer"
                />
                <span className="text-xs font-bold text-muted-text group-hover:text-main-text lowercase">I have securely saved my recovery key</span>
              </label>

              <RetroButton 
                onClick={() => {
                  setRecoveryKeyToShow(null);
                  setHasCopiedRecovery(false);
                }} 
                disabled={!hasCopiedRecovery} 
                className="w-full py-3 text-base mt-2"
              >
                Done
              </RetroButton>
            </div>
          </RetroWindow>
        </div>
      )}

      {/* 2. Recovery Key Restore Modal */}
      {showRestorePrompt && (
        <div className="fixed inset-0 z-[var(--z-modal)] bg-black/40 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <RetroWindow 
            title="e2ee_restore.exe" 
            className="w-full max-w-md shadow-2xl scale-up-15"
          >
            <form onSubmit={handleRestore} className="flex flex-col gap-5 py-2 text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2 animate-bounce">
                <Unlock size={32} className="text-primary" />
              </div>
              <h1 className="text-xl font-black lowercase text-primary">unlock chat history 🔒</h1>
              <p className="font-bold text-muted-text text-sm">
                We detected existing encrypted chats, but your encryption keys are not on this device. Enter your Recovery Key to unlock them.
              </p>

              <RetroInput 
                label="E2EE Recovery Key"
                icon={Key}
                placeholder="ATTIC-XXXX-XXXX-XXXX"
                value={restoreKeyInput}
                onChange={e => setRestoreKeyInput(e.target.value)}
                error={restoreError}
                required
                autoFocus
                disabled={isRestoring}
              />

              <RetroButton type="submit" disabled={isRestoring || !restoreKeyInput.trim()} className="w-full py-3 text-base">
                {isRestoring ? <Loader className="animate-spin" /> : 'Restore History'}
              </RetroButton>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-border opacity-20"></div>
                <span className="flex-shrink-0 mx-4 text-[10px] font-bold text-muted-text uppercase tracking-widest">or</span>
                <div className="flex-grow border-t border-border opacity-20"></div>
              </div>

              <div className="space-y-2 text-left">
                <p className="text-xs font-bold text-muted-text text-center">Lost your recovery key?</p>
                <RetroButton 
                  onClick={() => setShowResetConfirm(true)} 
                  variant="secondary" 
                  disabled={isRestoring}
                  className="w-full py-2.5 text-xs font-bold"
                >
                  Reset Chat History
                </RetroButton>
              </div>
            </form>
          </RetroWindow>
        </div>
      )}

      {/* 3. Confirm Reset Dialog */}
      {showResetConfirm && (
        <ConfirmDialog
          title="Reset encryption keys?"
          message="WARNING: Resetting your keys will generate a new recovery key, but all past encrypted messages will become permanently unreadable. This action cannot be undone."
          showCancel={true}
          onConfirm={handleResetHistory}
          onCancel={() => setShowResetConfirm(false)}
        />
      )}
    </ChatContext.Provider>
  );
}
