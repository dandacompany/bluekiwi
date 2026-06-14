/**
 * Transparent AES-256-GCM encryption for credential secrets at rest.
 *
 * PRODUCTION REQUIREMENT: set `CREDENTIALS_ENC_KEY` to a 32-byte key, expressed
 * either as 64 hex characters (`openssl rand -hex 32`) or as base64 of 32 bytes.
 * When the key is configured, secrets are encrypted before being written to the
 * database and decrypted only at explicit plaintext read sites.
 *
 * BACKWARD COMPATIBILITY: existing plaintext rows are read transparently —
 * `decryptSecret` passes through any value that is not an `enc:v1:` envelope.
 * Such rows are re-encrypted automatically on their next update. If no key is
 * configured (legacy/dev mode), `encryptSecret` returns its input unchanged and
 * logs a single warning.
 *
 * Envelope format (all segments base64url, no padding):
 *   enc:v1:<iv>:<authTag>:<ciphertext>
 * where iv is 12 bytes and authTag is the 16-byte GCM tag.
 */
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "crypto";

const ENVELOPE_PREFIX = "enc:v1:";
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit nonce recommended for GCM
const KEY_LENGTH = 32; // 256-bit key

let cachedKey: Buffer | null = null;
let keyResolved = false;
let warnedNoKey = false;

function resolveKey(): Buffer | null {
  if (keyResolved) return cachedKey;
  keyResolved = true;

  const raw = process.env.CREDENTIALS_ENC_KEY;
  if (!raw || raw.trim() === "") {
    cachedKey = null;
    return cachedKey;
  }

  const trimmed = raw.trim();
  let key: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    key = Buffer.from(trimmed, "hex");
  } else {
    const decoded = Buffer.from(trimmed, "base64");
    if (decoded.length !== KEY_LENGTH) {
      throw new Error(
        "CREDENTIALS_ENC_KEY must be 64 hex chars or base64 of 32 bytes",
      );
    }
    key = decoded;
  }

  if (key.length !== KEY_LENGTH) {
    throw new Error("CREDENTIALS_ENC_KEY must decode to exactly 32 bytes");
  }

  cachedKey = key;
  return cachedKey;
}

export function credentialsEncryptionEnabled(): boolean {
  return resolveKey() !== null;
}

export function isEncrypted(stored: string): boolean {
  return typeof stored === "string" && stored.startsWith(ENVELOPE_PREFIX);
}

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

export function encryptSecret(plain: string): string {
  const key = resolveKey();
  if (!key) {
    if (!warnedNoKey) {
      warnedNoKey = true;
      console.warn(
        "[crypto] CREDENTIALS_ENC_KEY not set — storing credential secrets in PLAINTEXT (legacy/dev mode). Set it in production: `openssl rand -hex 32`.",
      );
    }
    return plain;
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${ENVELOPE_PREFIX}${b64url(iv)}:${b64url(authTag)}:${b64url(ciphertext)}`;
}

export function decryptSecret(stored: string): string {
  if (!isEncrypted(stored)) {
    // Legacy plaintext passthrough (also covers no-key dev mode writes).
    return stored;
  }

  const rest = stored.slice(ENVELOPE_PREFIX.length);
  const parts = rest.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted credential envelope: malformed segments");
  }

  const key = resolveKey();
  if (!key) {
    throw new Error(
      "Encrypted credential found but CREDENTIALS_ENC_KEY is not configured",
    );
  }

  try {
    const iv = Buffer.from(parts[0], "base64url");
    const authTag = Buffer.from(parts[1], "base64url");
    const ciphertext = Buffer.from(parts[2], "base64url");
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const plain = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return plain.toString("utf8");
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : "unknown error";
    throw new Error(
      `Failed to decrypt credential secret (bad key or tampered data): ${detail}`,
    );
  }
}
