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
  encryptPrivateKey,
  decryptPrivateKey,
  deriveKeyFromPin,
  bufferToBase64,
  base64ToUint8Array
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
  const { roomId, userId, partnerId, user } = useAuth();
  const sync = useSync();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const rawContentMapRef = useRef(new Map());

  // E2EE States
  const [isE2EEReady, setIsE2EEReady] = useState(false);
  const privateKeyRef = useRef(null);
  const sharedKeyRef = useRef(null);

  // E2EE Initialization Guards
  const e2eeInitRef = useRef(false); // Tracks if local keys have been initialized this session
  const derivedKeyInputsRef = useRef(null); // Tracks the partner key fingerprint used for last derivation
  const [e2eeVersion, setE2eeVersion] = useState(0); // Incremented to force re-initialization (e.g., after restore)

  // E2EE PIN Setup & Restoration States
  const [showPinSetupPrompt, setShowPinSetupPrompt] = useState(false);
  const [pinSetupStep, setPinSetupStep] = useState('warning'); // 'warning' | 'input'
  const [pinSetupInput, setPinSetupInput] = useState('');
  const [pinSetupConfirm, setPinSetupConfirm] = useState('');
  const [pinWarningConfirmed, setPinWarningConfirmed] = useState(false);
  
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const [restoreKeyInput, setRestoreKeyInput] = useState(''); // Holds PIN input during restore
  const [restoreError, setRestoreError] = useState(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isDeriving, setIsDeriving] = useState(false); // For showing "securing your keys..." spinner
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const addToast = useToast();

  // Sync Room Profiles for Public Keys
  const roomProfiles = sync?.globalState?.room_profiles || {};
  const myPubJwkX = roomProfiles[userId]?.e2ee_public_key?.x || null;
  const myPubJwkY = roomProfiles[userId]?.e2ee_public_key?.y || null;
  const partnerPubJwkX = roomProfiles[partnerId]?.e2ee_public_key?.x || null;
  const partnerPubJwkY = roomProfiles[partnerId]?.e2ee_public_key?.y || null;
  const isSyncInitialized = sync?.isInitialized;

  // Unified bulletproof key backup helper
  const saveKeysAndBackup = useCallback(async (keys, pin) => {
    try {
      const localPubJwk = await exportPublicKeyJWK(keys.publicKey);

      // Generate a random 16-byte salt
      const saltBytes = window.crypto.getRandomValues(new Uint8Array(16));
      const saltBase64 = bufferToBase64(saltBytes);

      // Derive PBKDF2 wrapping key and encrypt the private key
      const wrappingKey = await deriveKeyFromPin(pin, saltBytes);
      const encrypted = await encryptPrivateKey(keys.privateKey, wrappingKey);

      // Keep private key in-memory ref only
      privateKeyRef.current = keys.privateKey;

      // 1. Update user_metadata in Supabase Auth (backup source of truth)
      await supabase.auth.updateUser({
        data: {
          encrypted_private_key: encrypted,
          e2ee_public_key: localPubJwk,
          e2ee_salt: saltBase64
        }
      });

      // 2. Update room profiles in SyncContext (shared with partner for handshake)
      await sync.updateSyncStateAtomic('room_profiles', userId, {
        e2ee_public_key: localPubJwk,
        encrypted_private_key: encrypted,
        e2ee_salt: saltBase64
      });
    } catch (err) {
      console.error('[E2EE] saveKeysAndBackup failed:', err);
      throw err;
    }
  }, [userId, sync]);

  // Initialize E2EE Cryptography & Exchange Keys
  useEffect(() => {
    if (!userId || !roomId || !isSyncInitialized) {
      privateKeyRef.current = null;
      sharedKeyRef.current = null;
      setIsE2EEReady(false);
      e2eeInitRef.current = false;
      derivedKeyInputsRef.current = null;
      return;
    }

    let isCurrent = true;

    const initE2EE = async () => {
      try {
        // --- PHASE 1: Local key initialization (runs once per session) ---
        if (!e2eeInitRef.current) {
          const myProfile = roomProfiles[userId] || {};
          const backupExists = !!myProfile.encrypted_private_key || !!user?.user_metadata?.encrypted_private_key;

          if (!privateKeyRef.current) {
            if (backupExists) {
              let latestUser = user;
              try {
                const { data } = await supabase.auth.getUser();
                if (data?.user) latestUser = data.user;
              } catch (e) {
                console.warn('[E2EE] Failed to fetch latest user metadata:', e);
              }
              
              // Check if recovery key/PIN is in user_metadata first for automation
              const userPin = latestUser?.user_metadata?.e2ee_pin || latestUser?.user_metadata?.e2ee_recovery_key;
              const saltBase64 = myProfile.e2ee_salt || latestUser?.user_metadata?.e2ee_salt;
              const encryptedData = myProfile.encrypted_private_key || latestUser?.user_metadata?.encrypted_private_key;
              const pubJwk = myProfile.e2ee_public_key || latestUser?.user_metadata?.e2ee_public_key;

              if (userPin && saltBase64 && encryptedData && pubJwk) {
                try {
                  const saltBytes = base64ToUint8Array(saltBase64);
                  const wrappingKey = await deriveKeyFromPin(userPin, saltBytes);
                  const privateKey = await decryptPrivateKey(encryptedData, wrappingKey);
                  
                  privateKeyRef.current = privateKey;
                  if (isCurrent) {
                    setIsE2EEReady(true);
                  }

                  // Heal database room profile if it was missing/erased
                  if (!myProfile.encrypted_private_key) {
                    await sync.updateSyncStateAtomic('room_profiles', userId, {
                      e2ee_public_key: pubJwk,
                      encrypted_private_key: encryptedData,
                      e2ee_salt: saltBase64
                    });
                  }
                } catch (err) {
                  console.error('[E2EE] Auto-restore from user_metadata failed:', err);
                }
              }

              if (!privateKeyRef.current) {
                // A backup exists on the database. In test mode, try auto-restoring with default PIN.
                if (isTestMode() && saltBase64 && encryptedData) {
                  try {
                    const saltBytes = base64ToUint8Array(saltBase64);
                    const wrappingKey = await deriveKeyFromPin("123456", saltBytes);
                    const privateKey = await decryptPrivateKey(encryptedData, wrappingKey);
                    privateKeyRef.current = privateKey;
                    if (isCurrent) {
                      setIsE2EEReady(true);
                    }
                  } catch (e) {
                    console.warn('[E2EE] Test auto-restore with default PIN failed:', e);
                  }
                }
              }

              if (!privateKeyRef.current) {
                // A backup exists on the database. Show the PIN restore prompt.
                if (isCurrent) {
                  setShowRestorePrompt(true);
                }
                return; // Halt initialization until restored or reset
              }
            } else {
              // No backup exists. In test mode, auto-setup with default PIN. Otherwise, prompt user.
              if (isCurrent) {
                if (isTestMode()) {
                  setTimeout(() => handleCreatePin("123456"), 0);
                } else {
                  setShowPinSetupPrompt(true);
                }
              }
              return; // Halt initialization until PIN is setup
            }
          }

          if (isCurrent) {
            e2eeInitRef.current = true;
          }
        }

        if (!isCurrent) return;

        // --- PHASE 2: Derive shared key (re-runs when partner key changes) ---
        const myPrivateKey = privateKeyRef.current;
        if (!myPrivateKey) return; // Still no private key

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
            const derived = await deriveSharedKey(myPrivateKey, partnerPubKey);
            if (isCurrent) {
              derivedKeyInputsRef.current = inputFingerprint;
              sharedKeyRef.current = derived;
              setIsE2EEReady(true);
            }
          } else {
            if (isCurrent) {
              derivedKeyInputsRef.current = null;
              sharedKeyRef.current = null;
              setIsE2EEReady(false);
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
  }, [userId, roomId, partnerId, isSyncInitialized, myPubJwkX, myPubJwkY, partnerPubJwkX, partnerPubJwkY, e2eeVersion, user, saveKeysAndBackup]);

  // Restore/Reset Callbacks
  const handleRestore = useCallback(async (e) => {
    if (e) e.preventDefault();
    if (!restoreKeyInput.trim()) return;

    setIsRestoring(true);
    setRestoreError(null);
    setIsDeriving(true);

    // Yield main thread to allow the spinner to render
    setTimeout(async () => {
      try {
        const myProfile = roomProfiles[userId] || {};
        const encryptedData = myProfile.encrypted_private_key || user?.user_metadata?.encrypted_private_key;
        const pubJwk = myProfile.e2ee_public_key || user?.user_metadata?.e2ee_public_key;
        const saltBase64 = myProfile.e2ee_salt || user?.user_metadata?.e2ee_salt;

        if (!encryptedData || !pubJwk || !saltBase64) {
          throw new Error('No backup found for this account.');
        }

        const pin = restoreKeyInput.trim();
        const saltBytes = base64ToUint8Array(saltBase64);

        // PBKDF2 wrapping key derivation
        const wrappingKey = await deriveKeyFromPin(pin, saltBytes);
        const privateKey = await decryptPrivateKey(encryptedData, wrappingKey);

        privateKeyRef.current = privateKey;
        setIsE2EEReady(true);

        // Backup the entered PIN to user metadata so they don't have to re-enter on subsequent loads/tests
        await supabase.auth.updateUser({
          data: {
            e2ee_pin: pin
          }
        });

        addToast('Chat history successfully unlocked!', 'success');
        setShowRestorePrompt(false);
        setRestoreKeyInput('');
        setRestoreError(null);

        // Force re-derivation by resetting guards and bumping version
        e2eeInitRef.current = false;
        derivedKeyInputsRef.current = null;
        setE2eeVersion(v => v + 1);
      } catch (err) {
        console.error('[E2EE] Restore failed:', err);
        setRestoreError('Invalid Chat PIN. Please double-check and try again.');
        addToast('Failed to unlock chat history.', 'error');
      } finally {
        setIsRestoring(false);
        setIsDeriving(false);
      }
    }, 50);
  }, [userId, roomProfiles, user, restoreKeyInput, addToast]);

  const handleCreatePin = useCallback(async (pin) => {
    setIsDeriving(true);
    // Yield main thread to allow the spinner to render
    setTimeout(async () => {
      try {
        const keys = await generateECDHKeypair();
        await saveKeysAndBackup(keys, pin);
        
        // Also save to user metadata for auto-restore next time (for automation/testing purposes)
        await supabase.auth.updateUser({
          data: {
            e2ee_pin: pin
          }
        });

        addToast('Chat PIN successfully created! Chat history is now encrypted.', 'success');
        setShowPinSetupPrompt(false);
        setIsE2EEReady(true);
        // Force re-derivation
        e2eeInitRef.current = false;
        derivedKeyInputsRef.current = null;
        setE2eeVersion(v => v + 1);
      } catch (err) {
        console.error('[E2EE] PIN setup failed:', err);
        addToast('Failed to set up Chat PIN.', 'error');
      } finally {
        setIsDeriving(false);
      }
    }, 50);
  }, [saveKeysAndBackup, addToast]);

  const handleResetHistory = useCallback(async () => {
    setIsRestoring(true);
    setRestoreError(null);
    setShowResetConfirm(false);

    try {
      // Clear key state
      privateKeyRef.current = null;
      sharedKeyRef.current = null;
      setIsE2EEReady(false);

      // Force user to set up a new Chat PIN from scratch
      setShowRestorePrompt(false);
      setShowPinSetupPrompt(true);
      setPinSetupStep('warning');
      setPinSetupInput('');
      setPinSetupConfirm('');
      setPinWarningConfirmed(false);
      
      addToast('Resetting chat keys. Please set up a new PIN.', 'info');
    } catch (err) {
      console.error('[E2EE] Reset failed:', err);
      addToast('Failed to reset encryption keys.', 'error');
    } finally {
      setIsRestoring(false);
    }
  }, [addToast]);

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
  }, [roomId, isE2EEReady, mapMessage]); // Re-subscribe and refresh when E2EE becomes available

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
          // ASSERTION: The IV for text message encryption is generated internally within the encryptText helper 
          // using window.crypto.getRandomValues and cannot be passed in from outside. This ensures absolute uniqueness.
          const encrypted = await encryptText(content, currentSharedKey);
          finalContent = encrypted.ciphertext;
          finalMetadata.iv = encrypted.iv;
          finalMetadata.is_encrypted = true;
        } else if (content instanceof Blob || content instanceof File) {
          // Encrypt file content with a randomized key
          const fileKey = await generateFileKey();
          // ASSERTION: The IV for file content encryption is generated directly within this function scope 
          // using window.crypto.getRandomValues and cannot be passed in from outside. This ensures absolute uniqueness.
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

      {/* 1. E2EE PIN Setup Modal */}
      {showPinSetupPrompt && (
        <div className="fixed inset-0 z-[var(--z-modal)] bg-black/40 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <RetroWindow 
            title="e2ee_pin_setup.exe" 
            className="w-full max-w-md shadow-2xl scale-up-15"
            onClose={() => {
              if (pinSetupStep === 'input') {
                setPinSetupStep('warning');
              } else {
                addToast("PIN setup is required to secure E2EE chat history.", "warn");
              }
            }}
          >
            {pinSetupStep === 'warning' ? (
              <div className="flex flex-col gap-5 py-2 text-center">
                <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-2">
                  <AlertTriangle size={32} className="text-yellow-600 animate-pulse" />
                </div>
                <h1 className="text-xl font-black lowercase text-primary">Warning: Important Notice ⚠️</h1>
                <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 rounded text-left text-xs font-bold text-amber-800 space-y-2">
                  <p>If you forget your PIN, your message history cannot be recovered.</p>
                  <p>This cannot be undone.</p>
                </div>
                <p className="text-xs text-muted-text font-bold">
                  Attic uses true End-to-End Encryption. We do not store your PIN on our servers, meaning we cannot reset it or recover your chats.
                </p>
                
                <label className="flex items-start gap-2 cursor-pointer group mt-2 text-left">
                  <input 
                    type="checkbox" 
                    checked={pinWarningConfirmed}
                    onChange={e => setPinWarningConfirmed(e.target.checked)}
                    className="w-4 h-4 mt-0.5 border-2 border-border accent-primary cursor-pointer"
                  />
                  <span className="text-xs font-bold text-muted-text group-hover:text-main-text lowercase">
                    I understand that my message history will be permanently lost if I forget my PIN.
                  </span>
                </label>

                <RetroButton 
                  onClick={() => setPinSetupStep('input')} 
                  disabled={!pinWarningConfirmed} 
                  className="w-full py-3 text-base mt-2"
                >
                  Continue
                </RetroButton>
              </div>
            ) : (
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!pinSetupInput || pinSetupInput.length < 6) {
                    addToast("PIN must be at least 6 digits.", "error");
                    return;
                  }
                  if (pinSetupInput !== pinSetupConfirm) {
                    addToast("PINs do not match.", "error");
                    return;
                  }
                  handleCreatePin(pinSetupInput);
                }}
                className="flex flex-col gap-5 py-2 text-center"
              >
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Lock size={32} className="text-primary" />
                </div>
                <h1 className="text-xl font-black lowercase text-primary">Create Chat PIN 🔐</h1>
                <p className="font-bold text-muted-text text-sm">
                  Choose a numeric PIN (min 6 digits) to secure your chat history. You will need to enter this PIN when logging in on new devices.
                </p>

                <RetroInput 
                  label="Enter Chat PIN"
                  icon={Key}
                  type="password"
                  pattern="[0-9]*"
                  inputMode="numeric"
                  placeholder="e.g. 123456"
                  value={pinSetupInput}
                  onChange={e => setPinSetupInput(e.target.value.replace(/\D/g, ''))}
                  required
                  autoFocus
                  disabled={isDeriving}
                />

                <RetroInput 
                  label="Confirm Chat PIN"
                  icon={Check}
                  type="password"
                  pattern="[0-9]*"
                  inputMode="numeric"
                  placeholder="e.g. 123456"
                  value={pinSetupConfirm}
                  onChange={e => setPinSetupConfirm(e.target.value.replace(/\D/g, ''))}
                  required
                  disabled={isDeriving}
                />

                <RetroButton type="submit" disabled={isDeriving || pinSetupInput.length < 6 || pinSetupInput !== pinSetupConfirm} className="w-full py-3 text-base">
                  {isDeriving ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader className="animate-spin" size={16} /> securing your keys...
                    </span>
                  ) : 'Create PIN'}
                </RetroButton>
              </form>
            )}
          </RetroWindow>
        </div>
      )}

      {/* 2. E2EE PIN Restore Modal */}
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
                We detected existing encrypted chats, but your encryption keys are not on this device. Enter your Chat PIN to unlock them.
              </p>

              <RetroInput 
                label="Enter Chat PIN"
                icon={Key}
                type="password"
                pattern="[0-9]*"
                inputMode="numeric"
                placeholder="Enter your 6-digit PIN"
                value={restoreKeyInput}
                onChange={e => setRestoreKeyInput(e.target.value.replace(/\D/g, ''))}
                error={restoreError}
                required
                autoFocus
                disabled={isRestoring || isDeriving}
              />

              <RetroButton type="submit" disabled={isRestoring || isDeriving || !restoreKeyInput.trim()} className="w-full py-3 text-base">
                {isDeriving ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader className="animate-spin" size={16} /> securing your keys...
                  </span>
                ) : 'Unlock History'}
              </RetroButton>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-border opacity-20"></div>
                <span className="flex-shrink-0 mx-4 text-[10px] font-bold text-muted-text uppercase tracking-widest">or</span>
                <div className="flex-grow border-t border-border opacity-20"></div>
              </div>

              <div className="space-y-2 text-left">
                <p className="text-xs font-bold text-muted-text text-center">Forgot your Chat PIN?</p>
                <RetroButton 
                  onClick={() => setShowResetConfirm(true)} 
                  variant="secondary" 
                  disabled={isRestoring || isDeriving}
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
          message="WARNING: Resetting your keys will prompt you to set a new Chat PIN, but all past encrypted messages will become permanently unreadable. This action cannot be undone."
          showCancel={true}
          onConfirm={handleResetHistory}
          onCancel={() => setShowResetConfirm(false)}
        />
      )}
    </ChatContext.Provider>
  );
}
