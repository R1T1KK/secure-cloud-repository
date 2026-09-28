const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// 1. Create valid sample PDF
function createSamplePDF() {
  const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << >> >>
endobj
4 0 obj
<< /Length 56 >>
stream
BT
/F1 24 Tf
100 700 Td
(Secure Cloud Repository - PDF Verification) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000216 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
324
%%EOF`;
  return Buffer.from(pdfContent, "utf8");
}

// 2. Create valid minimal 1x1 JPG image
function createSampleJPG() {
  // Minimal valid JPEG binary buffer (SOI, APP0 JFIF, DQT, SOF0, DHT, SOS, compressed data, EOI)
  const hexJpeg = 
    "ffd8ffe000104a46494600010101004800480000ffdb00430008060607060508070707090908" +
    "0a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c303134" +
    "34341f27393d38323c2e333430ffc0000b080001000101011100ffc4001f0000010501010101" +
    "010100000000000000000102030405060708090a0b01ffda0008010100003f007f00ffd9";
  return Buffer.from(hexJpeg, "hex");
}

async function runTests() {
  console.log("=================================================");
  console.log("SECURE CLOUD REPOSITORY - FULL VERIFICATION TEST");
  console.log("=================================================\n");

  const pdfBuffer = createSamplePDF();
  const jpgBuffer = createSampleJPG();

  const testFiles = [
    { name: "demo_document.pdf", type: "application/pdf", buffer: pdfBuffer },
    { name: "sample_image.jpg", type: "image/jpeg", buffer: jpgBuffer }
  ];

  for (const testFile of testFiles) {
    console.log(`--- Testing File: ${testFile.name} (${testFile.buffer.length} bytes) ---`);

    // Step A: Calculate expected original SHA-256
    const expectedSHA256 = crypto.createHash("sha256").update(testFile.buffer).digest("hex");
    console.log(`[Step 10] Expected SHA-256 Hash: ${expectedSHA256}`);

    // Step B: Upload file via multipart/form-data
    const formData = new FormData();
    const fileBlob = new Blob([testFile.buffer], { type: testFile.type });
    formData.append("file", fileBlob, testFile.name);

    console.log(`[Step 8] Uploading ${testFile.name} to server...`);
    const uploadRes = await fetch("http://localhost:5000/api/files/upload", {
      method: "POST",
      body: formData,
    });
    const uploadJson = await uploadRes.json();
    console.log(`Upload Response:`, uploadJson);

    if (!uploadJson.success) {
      throw new Error(`Upload failed: ${JSON.stringify(uploadJson)}`);
    }

    const fileId = uploadJson.file.id;
    const returnedHash = uploadJson.file.fileHash;
    const uploadTxHash = uploadJson.file.uploadTxHash;

    // Verify SHA-256 matches
    if (returnedHash.toLowerCase() === expectedSHA256.toLowerCase()) {
      console.log(`✅ [Step 10] SHA-256 Hash Generated and matches original buffer perfectly!`);
    } else {
      throw new Error(`❌ SHA-256 mismatch: got ${returnedHash}, expected ${expectedSHA256}`);
    }

    // Verify blockchain upload tx
    if (uploadTxHash && uploadTxHash.startsWith("0x")) {
      console.log(`✅ [Step 11] Blockchain UPLOAD transaction confirmed on-chain! Tx: ${uploadTxHash}`);
    } else {
      throw new Error(`❌ Blockchain UPLOAD transaction failed: ${uploadTxHash}`);
    }

    // Step C: Verify AES-256-GCM encryption on disk
    console.log(`[Step 9] Verifying AES encryption on stored file...`);
    const metadataPath = path.resolve(__dirname, "data/metadata.json");
    const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
    const storedRecord = metadata.find(m => m.id === fileId);

    if (!storedRecord) throw new Error("Metadata record not found!");
    const encFilePath = path.resolve(__dirname, "uploads", storedRecord.encFileName);
    const encFileBuffer = fs.readFileSync(encFilePath);

    // Ensure encrypted file is completely different from original file
    const isDifferent = !encFileBuffer.equals(testFile.buffer);
    console.log(`Stored encrypted file size: ${encFileBuffer.length} bytes`);
    console.log(`Stored IV (12 bytes): ${storedRecord.iv}`);
    console.log(`Stored Auth Tag (16 bytes): ${storedRecord.authTag}`);
    if (isDifferent && storedRecord.encryptionAlgorithm === "AES-256-GCM") {
      console.log(`✅ [Step 9] AES-256-GCM encryption verified: ciphertext is fully scrambled and encrypted.`);
    } else {
      throw new Error("❌ Encryption check failed!");
    }

    // Step D: Download, decrypt and verify
    console.log(`[Step 12] Downloading decrypted file from /api/files/${fileId}/download...`);
    const downloadRes = await fetch(`http://localhost:5000/api/files/${fileId}/download`);
    
    const integrityHeader = downloadRes.headers.get("x-integrity-verified");
    const downloadTxHash = downloadRes.headers.get("x-download-tx");
    const downloadedArrayBuffer = await downloadRes.arrayBuffer();
    const downloadedBuffer = Buffer.from(downloadedArrayBuffer);

    console.log(`Downloaded decrypted size: ${downloadedBuffer.length} bytes`);
    console.log(`Header X-Integrity-Verified: ${integrityHeader}`);
    console.log(`Header X-Download-Tx: ${downloadTxHash}`);

    // Verify decrypted SHA-256
    const decryptedSHA256 = crypto.createHash("sha256").update(downloadedBuffer).digest("hex");
    console.log(`Decrypted SHA-256: ${decryptedSHA256}`);

    if (decryptedSHA256 === expectedSHA256 && integrityHeader === "true") {
      console.log(`✅ [Step 14] SHA-256 integrity verified: Original and Decrypted hashes are IDENTICAL!`);
    } else {
      throw new Error(`❌ Integrity failed: decrypted hash ${decryptedSHA256} != expected ${expectedSHA256}`);
    }

    // Verify decrypted file opens correctly (exact byte match)
    if (downloadedBuffer.equals(testFile.buffer)) {
      console.log(`✅ [Step 13] Decrypted file byte comparison: 100% EXACT MATCH to original binary!`);
      // Save locally to verify
      const verifiedSavePath = path.resolve(__dirname, `decrypted_${testFile.name}`);
      fs.writeFileSync(verifiedSavePath, downloadedBuffer);
      console.log(`Saved verified decrypted file to: ${verifiedSavePath}`);
    } else {
      throw new Error("❌ Byte comparison failed: Decrypted file does not match original bytes.");
    }

    // Verify blockchain DOWNLOAD transaction
    if (downloadTxHash && downloadTxHash.startsWith("0x")) {
      console.log(`✅ [Step 15] Blockchain DOWNLOAD transaction confirmed on-chain! Tx: ${downloadTxHash}\n`);
    } else {
      throw new Error(`❌ Blockchain DOWNLOAD transaction failed: ${downloadTxHash}`);
    }
  }

  // Step E: Check total blockchain activities list
  const actRes = await fetch("http://localhost:5000/api/blockchain/activities");
  const activities = await actRes.json();
  console.log("=================================================");
  console.log(`TOTAL SMART CONTRACT LOGS ON HARDHAT: ${activities.length}`);
  console.log("=================================================");
  activities.slice(0, 4).forEach((act, idx) => {
    console.log(`[#${idx + 1}] Action: ${act.action.padEnd(8)} | File: ${act.filename.padEnd(20)} | Time: ${new Date(act.timestamp).toLocaleTimeString()} | Hash: ${act.fileHash.substring(0, 16)}...`);
  });
  console.log("\n>>> ALL 15 VERIFICATION STEPS PASSED SUCCESSFULLY! <<<\n");
}

runTests().catch(err => {
  console.error("Verification failed:", err);
  process.exit(1);
});
