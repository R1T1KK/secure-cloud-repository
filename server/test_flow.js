const fs = require("fs");
const path = require("path");

async function test() {
  const originalText = "Hello, College Demo! This is a test file for Secure Cloud Repository.";
  const sampleFilePath = path.join(__dirname, "sample_test.txt");
  fs.writeFileSync(sampleFilePath, originalText);

  console.log("1. Original Content:", originalText);

  // Upload test
  const formData = new FormData();
  const fileBlob = new Blob([fs.readFileSync(sampleFilePath)], { type: "text/plain" });
  formData.append("file", fileBlob, "sample_test.txt");

  const uploadRes = await fetch("http://localhost:5000/api/files/upload", {
    method: "POST",
    body: formData,
  });
  const uploadData = await uploadRes.json();
  console.log("2. Upload Response:", uploadData);

  if (!uploadData.success) {
    throw new Error("Upload failed: " + JSON.stringify(uploadData));
  }

  const fileId = uploadData.file.id;

  // Check files list
  const listRes = await fetch("http://localhost:5000/api/files");
  const files = await listRes.json();
  console.log("3. Files in Repository:", files.length);

  // Download test
  const downloadRes = await fetch(`http://localhost:5000/api/files/${fileId}/download`);
  const downloadedText = await downloadRes.text();
  const integrityVerified = downloadRes.headers.get("x-integrity-verified");
  const downloadTx = downloadRes.headers.get("x-download-tx");

  console.log("4. Downloaded Text:", downloadedText);
  console.log("5. Integrity Verified Header:", integrityVerified);
  console.log("6. Download Tx Hash:", downloadTx);
  console.log("7. Content Match:", downloadedText === originalText ? "SUCCESS (100% Match!)" : "FAILED");

  // Check blockchain activities
  const actRes = await fetch("http://localhost:5000/api/blockchain/activities");
  const activities = await actRes.json();
  console.log("8. Total Blockchain Activities Logged:", activities.length);
  console.log("Activities detail:", JSON.stringify(activities, null, 2));

  // Clean up sample file
  if (fs.existsSync(sampleFilePath)) fs.unlinkSync(sampleFilePath);
}

test().catch(console.error);
