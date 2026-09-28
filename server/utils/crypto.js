const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// 256-bit (32-byte) key derivation/fallback for legacy demo files
const DEFAULT_SECRET = process.env.ENCRYPTION_SECRET || "college_demo_secure_key_32_bytes_long!";
const DEFAULT_ENCRYPTION_KEY = crypto.createHash("sha256").update(DEFAULT_SECRET).digest();

// RSA Key Pair Storage
const KEYS_DIR = path.resolve(__dirname, "..", "keys");
const PRIVATE_KEY_PATH = path.join(KEYS_DIR, "private_key.pem");
const PUBLIC_KEY_PATH = path.join(KEYS_DIR, "public_key.pem");

let rsaPrivateKey = null;
let rsaPublicKey = null;

/**
 * Initializes RSA-2048 key pair.
 * Generates and stores them securely if they do not exist.
 */
function initRSAKeys() {
  if (!fs.existsSync(KEYS_DIR)) {
    fs.mkdirSync(KEYS_DIR, { recursive: true });
  }

  if (fs.existsSync(PRIVATE_KEY_PATH) && fs.existsSync(PUBLIC_KEY_PATH)) {
    rsaPrivateKey = fs.readFileSync(PRIVATE_KEY_PATH, "utf8");
    rsaPublicKey = fs.readFileSync(PUBLIC_KEY_PATH, "utf8");
  } else {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: "spki",
        format: "pem",
      },
      privateKeyEncoding: {
        type: "pkcs8",
        format: "pem",
      },
    });

    fs.writeFileSync(PRIVATE_KEY_PATH, privateKey, { mode: 0o600 });
    fs.writeFileSync(PUBLIC_KEY_PATH, publicKey);
    rsaPrivateKey = privateKey;
    rsaPublicKey = publicKey;
  }
}

// Initialize keys on startup
initRSAKeys();

/**
 * Computes SHA-256 hash of a buffer.
 * @param {Buffer} buffer
 * @returns {string} Hex hash string
 */
function computeSHA256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * Generates a cryptographically secure random 256-bit (32-byte) AES key.
 * @returns {Buffer}
 */
function generateAESKey() {
  return crypto.randomBytes(32);
}

/**
 * Encrypts/wraps the AES key using the RSA public key with RSA-OAEP (SHA-256).
 * @param {Buffer} aesKey
 * @returns {string} Hex string of encrypted AES key
 */
function encryptAESKeyWithRSA(aesKey) {
  const encrypted = crypto.publicEncrypt(
    {
      key: rsaPublicKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    aesKey
  );
  return encrypted.toString("hex");
}

/**
 * Decrypts/unwraps the AES key using the RSA private key with RSA-OAEP (SHA-256).
 * @param {string} encryptedKeyHex
 * @returns {Buffer} Recovered 32-byte AES key
 */
function decryptAESKeyWithRSA(encryptedKeyHex) {
  return crypto.privateDecrypt(
    {
      key: rsaPrivateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(encryptedKeyHex, "hex")
  );
}

/**
 * Encrypts a buffer using AES-256-GCM.
 * @param {Buffer} buffer
 * @param {Buffer} [customKey] Optional 32-byte key; defaults to DEFAULT_ENCRYPTION_KEY
 * @returns {{ encryptedBuffer: Buffer, iv: string, authTag: string }}
 */
function encryptAES_GCM(buffer, customKey) {
  const key = customKey || DEFAULT_ENCRYPTION_KEY;
  // 12-byte IV recommended for GCM
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedBuffer: encrypted,
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
  };
}

/**
 * Decrypts an encrypted buffer using AES-256-GCM and verifies authenticity.
 * @param {Buffer} encryptedBuffer
 * @param {string} ivHex
 * @param {string} authTagHex
 * @param {Buffer} [customKey] Optional 32-byte key; defaults to DEFAULT_ENCRYPTION_KEY
 * @returns {Buffer} Decrypted buffer
 */
function decryptAES_GCM(encryptedBuffer, ivHex, authTagHex, customKey) {
  const key = customKey || DEFAULT_ENCRYPTION_KEY;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
  return decrypted;
}

/**
 * Creates an RSA-PSS digital signature of a hash string using the server's private key.
 * @param {string} hashString
 * @returns {string} Hex signature string
 */
function signWithRSA_PSS(hashString) {
  const signer = crypto.createSign("sha256");
  signer.update(hashString);
  signer.end();

  const signature = signer.sign({
    key: rsaPrivateKey,
    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
    saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
  });

  return signature.toString("hex");
}

/**
 * Verifies an RSA-PSS digital signature using the server's RSA public key.
 * @param {string} hashString
 * @param {string} signatureHex
 * @returns {boolean}
 */
function verifyRSA_PSS(hashString, signatureHex) {
  try {
    const verifier = crypto.createVerify("sha256");
    verifier.update(hashString);
    verifier.end();

    return verifier.verify(
      {
        key: rsaPublicKey,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
      },
      Buffer.from(signatureHex, "hex")
    );
  } catch (err) {
    return false;
  }
}

/**
 * Returns the public key in PEM format (safe to share).
 * @returns {string}
 */
function getPublicKey() {
  return rsaPublicKey;
}

module.exports = {
  computeSHA256,
  generateAESKey,
  encryptAESKeyWithRSA,
  decryptAESKeyWithRSA,
  encryptAES_GCM,
  decryptAES_GCM,
  signWithRSA_PSS,
  verifyRSA_PSS,
  getPublicKey,
};
