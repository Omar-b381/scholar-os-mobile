import CryptoJS from 'crypto-js';

// Derive a 32-byte key using SHA-256 from the passphrase
function getDerivedKey(passphrase: string): CryptoJS.lib.WordArray {
  return CryptoJS.SHA256(passphrase);
}

// Encrypt payload to AES-256-CBC format (matches desktop Node crypto exactly)
export function encryptPayload(data: any, key: string): string {
  try {
    const jsonStr = JSON.stringify(data);
    const hashedKey = getDerivedKey(key);
    const iv = CryptoJS.lib.WordArray.random(16); // 16 random bytes IV

    const encrypted = CryptoJS.AES.encrypt(jsonStr, hashedKey, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });

    const ivHex = iv.toString(CryptoJS.enc.Hex);
    const cipherHex = encrypted.ciphertext.toString(CryptoJS.enc.Hex);

    return `${ivHex}:${cipherHex}`;
  } catch (err) {
    console.error('[SyncGuard Mobile] Encryption Error:', err);
    throw new Error('فشل تشفير البيانات الأكاديمية');
  }
}

// Decrypt payload from AES-256-CBC format (matches desktop Node crypto exactly)
export function decryptPayload(cipherText: string, key: string): any {
  try {
    const parts = cipherText.split(':');
    if (parts.length < 2) {
      throw new Error('تنسيق البيانات المشفرة غير صالح');
    }

    const ivHex = parts.shift()!;
    const cipherHex = parts.join(':');

    const iv = CryptoJS.enc.Hex.parse(ivHex);
    const ciphertext = CryptoJS.enc.Hex.parse(cipherHex);
    const hashedKey = getDerivedKey(key);

    const cipherParams = CryptoJS.lib.CipherParams.create({
      ciphertext: ciphertext
    });

    const decrypted = CryptoJS.AES.decrypt(cipherParams, hashedKey, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });

    const decryptedStr = decrypted.toString(CryptoJS.enc.Utf8);
    if (!decryptedStr) {
      throw new Error('فشل فك التشفير. يرجى التحقق من مفتاح التشفير الخاص بك.');
    }

    return JSON.parse(decryptedStr);
  } catch (err: any) {
    console.error('[SyncGuard Mobile] Decryption Error:', err);
    throw new Error(err.message || 'فشل فك تشفير البيانات الأكاديمية');
  }
}

// Generate SHA-256 checksum for verification integrity
export function calculateSHA256(data: any): string {
  try {
    const jsonStr = JSON.stringify(data);
    return CryptoJS.SHA256(jsonStr).toString(CryptoJS.enc.Hex);
  } catch (err) {
    console.error('[SyncGuard Mobile] Checksum Calculation Error:', err);
    return '';
  }
}
