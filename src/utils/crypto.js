import localforage from 'localforage';

/**
 * Generates an ECDH P-256 key pair.
 * The private key is set to non-extractable for maximum security.
 */
export async function generateECDHKeypair() {
  return await window.crypto.subtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-256"
    },
    false, // Private key is non-extractable
    ["deriveKey", "deriveBits"]
  );
}

/**
 * Exports a public key to JWK format.
 */
export async function exportPublicKeyJWK(publicKey) {
  return await window.crypto.subtle.exportKey("jwk", publicKey);
}

/**
 * Imports a partner's public key from JWK format.
 */
export async function importPublicKeyJWK(jwk) {
  return await window.crypto.subtle.importKey(
    "jwk",
    jwk,
    {
      name: "ECDH",
      namedCurve: "P-256"
    },
    true, // Extractable
    [] // Empty usage for imported ECDH public key (used for derivation parameter)
  );
}

/**
 * Derives a shared 256-bit AES-GCM key using local private key and partner's public key.
 */
export async function deriveSharedKey(privateKey, partnerPublicKey) {
  return await window.crypto.subtle.deriveKey(
    {
      name: "ECDH",
      public: partnerPublicKey
    },
    privateKey,
    {
      name: "AES-GCM",
      length: 256
    },
    false, // Derived AES key is non-extractable
    ["encrypt", "decrypt"]
  );
}

/**
 * Helper to convert an ArrayBuffer to a Base64 string.
 */
export function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Helper to convert a Base64 string to a Uint8Array.
 */
export function base64ToUint8Array(base64) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encrypts plain text using the derived shared key.
 * Returns an object containing the ciphertext and IV as Base64 strings.
 */
export async function encryptText(text, derivedKey) {
  const encoded = new TextEncoder().encode(text);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv
    },
    derivedKey,
    encoded
  );
  return {
    ciphertext: bufferToBase64(ciphertextBuffer),
    iv: bufferToBase64(iv)
  };
}

/**
 * Decrypts ciphertext (Base64) using the derived shared key and IV (Base64).
 */
export async function decryptText(ciphertextBase64, ivBase64, derivedKey) {
  const ciphertext = base64ToUint8Array(ciphertextBase64);
  const iv = base64ToUint8Array(ivBase64);
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv
    },
    derivedKey,
    ciphertext
  );
  return new TextDecoder().decode(decryptedBuffer);
}

/**
 * Generates a random 256-bit AES-GCM file key.
 * Must be extractable so we can encrypt it and share it with the partner.
 */
export async function generateFileKey() {
  return await window.crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256
    },
    true, // Extractable
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts a File or Blob using a file key and IV.
 * Returns a new encrypted Blob.
 */
export async function encryptFile(fileBlob, fileKey, iv) {
  const arrayBuffer = await fileBlob.arrayBuffer();
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv
    },
    fileKey,
    arrayBuffer
  );
  return new Blob([encryptedBuffer], { type: 'application/octet-stream' });
}

/**
 * Decrypts an encrypted Blob using a file key, IV, and targeted MIME type.
 * Returns a decrypted Blob.
 */
export async function decryptFile(encryptedBlob, fileKey, iv, mimeType) {
  const arrayBuffer = await encryptedBlob.arrayBuffer();
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv
    },
    fileKey,
    arrayBuffer
  );
  return new Blob([decryptedBuffer], { type: mimeType });
}

/**
 * Encrypts a file's key and IV using the derived shared key.
 * Returns metadata object with ciphertext and iv as Base64 strings.
 */
export async function encryptFileMetadata(fileKey, fileIv, derivedKey) {
  const rawKey = await window.crypto.subtle.exportKey("raw", fileKey);
  const metaObj = {
    key: bufferToBase64(rawKey),
    iv: bufferToBase64(fileIv)
  };
  const encoded = new TextEncoder().encode(JSON.stringify(metaObj));
  const metaIv = window.crypto.getRandomValues(new Uint8Array(12));
  const encryptedMeta = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: metaIv
    },
    derivedKey,
    encoded
  );
  return {
    ciphertext: bufferToBase64(encryptedMeta),
    iv: bufferToBase64(metaIv)
  };
}

/**
 * Decrypts a file's key and IV metadata using the derived shared key.
 * Returns the imported fileKey and fileIv as Uint8Array.
 */
export async function decryptFileMetadata(encryptedMetaBase64, metaIvBase64, derivedKey) {
  const ciphertext = base64ToUint8Array(encryptedMetaBase64);
  const iv = base64ToUint8Array(metaIvBase64);
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv
    },
    derivedKey,
    ciphertext
  );
  const decoded = new TextDecoder().decode(decryptedBuffer);
  const metaObj = JSON.parse(decoded);

  const rawKey = base64ToUint8Array(metaObj.key);
  const fileIv = base64ToUint8Array(metaObj.iv);

  const fileKey = await window.crypto.subtle.importKey(
    "raw",
    rawKey,
    "AES-GCM",
    true,
    ["encrypt", "decrypt"]
  );

  return { fileKey, fileIv };
}

/**
 * Loads the user's ECDH key pair from localforage.
 */
export async function getLocalKeypair(userId) {
  return await localforage.getItem(`e2ee_keys_${userId}`);
}

/**
 * Saves the user's ECDH key pair to localforage.
 */
export async function saveLocalKeypair(userId, keypair) {
  await localforage.setItem(`e2ee_keys_${userId}`, keypair);
}
