/**
 * AES-256-GCM symmetric encryption for chat messages.
 * - Key: 32-byte hex string from CHAT_ENCRYPTION_KEY in .env
 * - Each message gets a unique random IV (12 bytes) → no two ciphertexts are the same even for identical plaintext
 * - Auth tag (16 bytes) prevents tampering
 * - Stored format: "<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 */
const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // bytes — recommended for GCM
const KEY_HEX = process.env.CHAT_ENCRYPTION_KEY || "";

function getKey() {
  if (!KEY_HEX || KEY_HEX.length !== 64) {
    throw new Error(
      "❌ CHAT_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  return Buffer.from(KEY_HEX, "hex");
}

/**
 * Encrypt plaintext → "<iv>:<authTag>:<ciphertext>" (all hex)
 */
function encrypt(plaintext) {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

/**
 * Decrypt "<iv>:<authTag>:<ciphertext>" → plaintext string
 * Returns null if decryption fails (tampered or wrong key).
 */
function decrypt(stored) {
  try {
    const key = getKey();
    const [ivHex, authTagHex, ciphertextHex] = stored.split(":");
    if (!ivHex || !authTagHex || !ciphertextHex) return null;

    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const ciphertext = Buffer.from(ciphertextHex, "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    return null; // decryption failed — key mismatch or tampered data
  }
}

module.exports = { encrypt, decrypt };
