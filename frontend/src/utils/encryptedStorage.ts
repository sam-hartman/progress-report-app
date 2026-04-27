import CryptoJS from 'crypto-js';
import type { StateStorage } from 'zustand/middleware';

const ENCRYPTION_KEY_STORAGE = 'qpr-encryption-key';

function getOrCreateEncryptionKey(): string {
  const existing = localStorage.getItem(ENCRYPTION_KEY_STORAGE);
  if (existing) {
    return existing;
  }
  const key = CryptoJS.lib.WordArray.random(32).toString();
  localStorage.setItem(ENCRYPTION_KEY_STORAGE, key);
  return key;
}

function encrypt(data: string, key: string): string {
  return CryptoJS.AES.encrypt(data, key).toString();
}

function decrypt(ciphertext: string, key: string): string {
  const bytes = CryptoJS.AES.decrypt(ciphertext, key);
  return bytes.toString(CryptoJS.enc.Utf8);
}

function isEncrypted(value: string): boolean {
  // AES encrypted strings from crypto-js are base64-encoded and
  // typically start with "U2Fsd" (the base64 of "Salted__").
  // A simple heuristic: if it parses as valid JSON, it's unencrypted.
  try {
    JSON.parse(value);
    return false;
  } catch {
    return true;
  }
}

function migrateUnencryptedData(storageKey: string, key: string): void {
  const raw = localStorage.getItem(storageKey);
  if (raw === null) {
    return;
  }
  if (!isEncrypted(raw)) {
    // Data is unencrypted JSON - encrypt it in place
    const encrypted = encrypt(raw, key);
    localStorage.setItem(storageKey, encrypted);
  }
}

export const encryptedStorage: StateStorage = {
  getItem(name: string): string | null {
    const key = getOrCreateEncryptionKey();

    // Handle migration of unencrypted data on first read
    migrateUnencryptedData(name, key);

    const raw = localStorage.getItem(name);
    if (raw === null) {
      return null;
    }

    try {
      const decrypted = decrypt(raw, key);
      if (!decrypted) {
        // Decryption produced empty string - data may be corrupted
        return null;
      }
      return decrypted;
    } catch {
      // If decryption fails, the data may be corrupted; return null
      return null;
    }
  },

  setItem(name: string, value: string): void {
    const key = getOrCreateEncryptionKey();
    const encrypted = encrypt(value, key);
    localStorage.setItem(name, encrypted);
  },

  removeItem(name: string): void {
    localStorage.removeItem(name);
  },
};
