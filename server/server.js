require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const {
  computeSHA256,
  generateAESKey,
  encryptAESKeyWithRSA,
  decryptAESKeyWithRSA,
  encryptAES_GCM,
  decryptAES_GCM,
  signWithRSA_PSS,
  verifyRSA_PSS,
  getPublicKey,
} = require("./utils/crypto");
const {
  recordActivityOnChain,
  getActivitiesFromChain,
  checkBlockchainStatus,
} = require("./utils/blockchain");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const UPLOADS_DIR = path.resolve(__dirname, "uploads");
const DATA_DIR = path.resolve(__dirname, "data");
const METADATA_FILE = path.join(DATA_DIR, "metadata.json");

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(METADATA_FILE)) fs.writeFileSync(METADATA_FILE, JSON.stringify([], null, 2));

function readMetadata() {
  try {
    const data = fs.readFileSync(METADATA_FILE, "utf8");
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

function saveMetadata(items) {
  fs.writeFileSync(METADATA_FILE, JSON.stringify(items, null, 2));
}

// Multer memory storage so we can hash and encrypt in memory before writing to disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB demo limit
});

// 1. Status Check
app.get("/api/status", async (req, res) => {
  const blockchainStatus = await checkBlockchainStatus();
  res.json({
    status: "online",
    storage: "local-encrypted",
    encryption: "AES-256-GCM",
    rsaKeyProtection: "RSA-2048-OAEP",
    digitalSignature: "RSA-PSS-SHA256",
    integrity: "SHA-256",
    blockchain: blockchainStatus,
  });
});

// 2. Public Key Export
app.get("/api/keys/public", (req, res) => {
  res.json({
    algorithm: "RSA-2048",
    padding: "OAEP / PSS",
    publicKey: getPublicKey(),
  });
});

// 3. Upload, Encrypt, and Sign File
app.post("/api/files/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    const originalName = req.file.originalname;
    const fileBuffer = req.file.buffer;
    const size = req.file.size;

    // Step A: Compute SHA-256 Hash of original file
    const fileHash = computeSHA256(fileBuffer);

    // Step B: Generate unique random AES-256 key (32 bytes)
    const aesKey = generateAESKey();

    // Step C: Encrypt / Wrap AES key using RSA-2048 public key with RSA-OAEP
    const encryptedAesKey = encryptAESKeyWithRSA(aesKey);

    // Step D: Encrypt file buffer with AES-256-GCM using the unique AES key
    const { encryptedBuffer, iv, authTag } = encryptAES_GCM(fileBuffer, aesKey);

    // Step E: Create RSA-PSS Digital Signature of SHA-256 hash using server private key
    const digitalSignature = signWithRSA_PSS(fileHash);

    // Step F: Save encrypted file to disk
    const fileId = "file_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8);
    const encFileName = `${fileId}.enc`;
    const encFilePath = path.join(UPLOADS_DIR, encFileName);
    fs.writeFileSync(encFilePath, encryptedBuffer);

    // Step G: Log UPLOAD on Hardhat Blockchain
    const blockchainLog = await recordActivityOnChain(originalName, fileHash, "UPLOAD");

    // Step H: Store record in metadata.json with requested format and backward compatibility
    const metadata = readMetadata();
    const newRecord = {
      id: fileId,
      file_name: originalName,
      originalName: originalName,
      size,
      mimeType: req.file.mimetype || "application/octet-stream",
      file_hash: fileHash,
      fileHash: fileHash,
      encrypted_aes_key: encryptedAesKey,
      encryptedAesKey: encryptedAesKey,
      digital_signature: digitalSignature,
      digitalSignature: digitalSignature,
      signature_valid: true,
      encFileName,
      iv,
      auth_tag: authTag,
      authTag: authTag,
      uploadTxHash: blockchainLog.txHash,
      blockchainRecorded: blockchainLog.success,
      encryptionAlgorithm: "AES-256-GCM (RSA-2048 Protected)",
      signatureAlgorithm: "RSA-PSS-SHA256",
      rsaProtected: true,
      upload_time: new Date().toISOString(),
      uploadedAt: new Date().toISOString(),
    };

    metadata.unshift(newRecord);
    saveMetadata(metadata);

    res.status(201).json({
      success: true,
      message: "File encrypted with AES-256, key protected with RSA-2048, signed with RSA-PSS, and recorded on blockchain.",
      file: {
        id: newRecord.id,
        file_name: newRecord.file_name,
        originalName: newRecord.originalName,
        size: newRecord.size,
        file_hash: newRecord.file_hash,
        fileHash: newRecord.fileHash,
        encrypted_aes_key: newRecord.encrypted_aes_key,
        digital_signature: newRecord.digital_signature,
        signature_valid: true,
        uploadTxHash: newRecord.uploadTxHash,
        upload_time: newRecord.upload_time,
        uploadedAt: newRecord.uploadedAt,
        encryptionAlgorithm: newRecord.encryptionAlgorithm,
        rsaProtected: true,
        blockchainRecorded: newRecord.blockchainRecorded,
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "File upload/encryption failed: " + error.message });
  }
});

// 4. List Files
app.get("/api/files", (req, res) => {
  try {
    const metadata = readMetadata();
    const publicList = metadata.map((item) => {
      const fileName = item.file_name || item.originalName;
      const fileHash = item.file_hash || item.fileHash;
      const encKey = item.encrypted_aes_key || item.encryptedAesKey || null;
      const sig = item.digital_signature || item.digitalSignature || null;
      const uploadTime = item.upload_time || item.uploadedAt;

      // Verify signature if present
      const isSignatureValid = sig ? verifyRSA_PSS(fileHash, sig) : null;

      return {
        id: item.id,
        file_name: fileName,
        originalName: fileName,
        size: item.size,
        file_hash: fileHash,
        fileHash: fileHash,
        encrypted_aes_key: encKey,
        digital_signature: sig,
        signature_valid: isSignatureValid,
        uploadTxHash: item.uploadTxHash,
        upload_time: uploadTime,
        uploadedAt: uploadTime,
        encryptionAlgorithm: item.encryptionAlgorithm || (encKey ? "AES-256-GCM (RSA-2048 Protected)" : "AES-256-GCM"),
        rsaProtected: !!encKey,
        blockchainRecorded: item.blockchainRecorded,
      };
    });
    res.json(publicList);
  } catch (error) {
    res.status(500).json({ error: "Failed to read file list" });
  }
});

// 5. Download, Recover AES Key, Decrypt and Verify File
app.get("/api/files/:id/download", async (req, res) => {
  try {
    const { id } = req.params;
    const metadata = readMetadata();
    const fileRecord = metadata.find((f) => f.id === id);

    if (!fileRecord) {
      return res.status(404).json({ error: "File not found" });
    }

    const encFilePath = path.join(UPLOADS_DIR, fileRecord.encFileName);
    if (!fs.existsSync(encFilePath)) {
      return res.status(404).json({ error: "Encrypted file missing from disk" });
    }

    const encBuffer = fs.readFileSync(encFilePath);
    const fileName = fileRecord.file_name || fileRecord.originalName;
    const fileHash = fileRecord.file_hash || fileRecord.fileHash;
    const encAesKey = fileRecord.encrypted_aes_key || fileRecord.encryptedAesKey;
    const signature = fileRecord.digital_signature || fileRecord.digitalSignature;
    const authTag = fileRecord.auth_tag || fileRecord.authTag;

    // Step A: Recover AES-256 Key using RSA Private Key (if RSA protected)
    let decryptedBuffer;
    let rsaRecovered = false;

    if (encAesKey) {
      const recoveredAesKey = decryptAESKeyWithRSA(encAesKey);
      decryptedBuffer = decryptAES_GCM(encBuffer, fileRecord.iv, authTag, recoveredAesKey);
      rsaRecovered = true;
    } else {
      // Legacy fallback
      decryptedBuffer = decryptAES_GCM(encBuffer, fileRecord.iv, authTag);
    }

    // Step B: Recalculate SHA-256 hash and verify integrity
    const decryptedHash = computeSHA256(decryptedBuffer);
    const isIntegrityVerified = decryptedHash.toLowerCase() === fileHash.toLowerCase();

    if (!isIntegrityVerified) {
      return res.status(400).json({
        error: "Integrity check failed: Decrypted file hash does not match original SHA-256 hash!",
      });
    }

    // Step C: Verify Digital Signature using RSA Public Key
    let isSignatureValid = false;
    if (signature) {
      isSignatureValid = verifyRSA_PSS(fileHash, signature);
    } else {
      isSignatureValid = true; // Legacy file without signature
    }

    // Step D: Log DOWNLOAD activity on Hardhat Blockchain
    const blockchainLog = await recordActivityOnChain(fileName, fileHash, "DOWNLOAD");

    // Expose verification headers to client
    res.setHeader(
      "Access-Control-Expose-Headers",
      "Content-Disposition, X-Integrity-Verified, X-Signature-Valid, X-RSA-Recovered, X-Original-Hash, X-Decrypted-Hash, X-Download-Tx"
    );
    res.setHeader("X-Integrity-Verified", isIntegrityVerified ? "true" : "false");
    res.setHeader("X-Signature-Valid", isSignatureValid ? "true" : "false");
    res.setHeader("X-RSA-Recovered", rsaRecovered ? "true" : "legacy");
    res.setHeader("X-Original-Hash", fileHash);
    res.setHeader("X-Decrypted-Hash", decryptedHash);
    res.setHeader("X-Download-Tx", blockchainLog.txHash || "N/A");
    res.setHeader("Content-Type", fileRecord.mimeType || "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(fileName)}"`
    );

    res.send(decryptedBuffer);
  } catch (error) {
    console.error("Download error:", error);
    res.status(500).json({ error: "Decryption / download failed: " + error.message });
  }
});

// 6. Fetch Blockchain Activities
app.get("/api/blockchain/activities", async (req, res) => {
  try {
    const activities = await getActivitiesFromChain();
    res.json(activities);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch activities: " + error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Secure Cloud Repository Server running on http://localhost:${PORT}`);
});
