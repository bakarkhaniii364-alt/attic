/**
 * Web Crypto API Utility for End-to-End Encryption
 */

// Robust base64 conversion helper to prevent stack overflow on large arrays
function uint8ArrayToBase64(bytes) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Generate a new AES-GCM 256-bit key
export async function generateKey() {
  return await window.crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256,
    },
    true, // extractable
    ["encrypt", "decrypt"]
  );
}

// Export the key to a raw Base64 string for transmission/storage
export async function exportKey(key) {
  const exported = await window.crypto.subtle.exportKey("raw", key);
  const exportedKeyBuffer = new Uint8Array(exported);
  const base64Key = uint8ArrayToBase64(exportedKeyBuffer);
  return base64Key;
}

// Import a raw Base64 string back into a CryptoKey
export async function importKey(base64Key) {
  const binaryString = atob(base64Key);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return await window.crypto.subtle.importKey(
    "raw",
    bytes,
    {
      name: "AES-GCM",
    },
    true,
    ["encrypt", "decrypt"]
  );
}

// Encrypt plaintext and return base64 ciphertext & iv
export async function encryptMessage(text, key) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  
  // Initialization Vector must be unique per encryption
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    data
  );
  
  const ciphertextBytes = new Uint8Array(ciphertextBuffer);
  
  return {
    ciphertext: uint8ArrayToBase64(ciphertextBytes),
    iv: uint8ArrayToBase64(iv)
  };
}

// Decrypt base64 ciphertext & iv back to plaintext
export async function decryptMessage(encryptedObj, key) {
  try {
    const { ciphertext, iv } = encryptedObj;
    
    // Decode base64 to Uint8Array
    const cipherBinary = atob(ciphertext);
    const cipherBytes = new Uint8Array(cipherBinary.length);
    for (let i = 0; i < cipherBinary.length; i++) {
      cipherBytes[i] = cipherBinary.charCodeAt(i);
    }
    
    const ivBinary = atob(iv);
    const ivBytes = new Uint8Array(ivBinary.length);
    for (let i = 0; i < ivBinary.length; i++) {
      ivBytes[i] = ivBinary.charCodeAt(i);
    }
    
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: ivBytes,
      },
      key,
      cipherBytes
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (err) {
    console.error("Decryption failed", err);
    throw new Error("Decryption failed");
  }
}

// LocalStorage helpers
export function saveLocalKey(roomId, base64Key) {
    try {
        localStorage.setItem(`e2ee_key_${roomId}`, base64Key);
    } catch(e) {
        console.error("Failed to save E2EE key locally", e);
    }
}

export function getLocalKey(roomId) {
    try {
        return localStorage.getItem(`e2ee_key_${roomId}`);
    } catch(e) {
        return null;
    }
}
