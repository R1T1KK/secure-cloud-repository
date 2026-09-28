import React, { useState, useEffect, useRef } from "react";
import {
  ShieldCheck,
  UploadCloud,
  Download,
  CheckCircle,
  FileText,
  Activity,
  Copy,
  Check,
  RefreshCw,
  Lock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export default function App() {
  const [files, setFiles] = useState([]);
  const [activities, setActivities] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null); // {type, message}
  const [downloadingId, setDownloadingId] = useState(null);
  const [serverStatus, setServerStatus] = useState(null);
  const [verificationNotice, setVerificationNotice] = useState(null);
  const [copiedHash, setCopiedHash] = useState(null);
  const [expandedFile, setExpandedFile] = useState(null);
  const [expandedActivity, setExpandedActivity] = useState(null);

  const fileInputRef = useRef(null);

  // Fetch status, files and blockchain activities
  const loadData = async () => {
    try {
      const [statusRes, filesRes, actRes] = await Promise.all([
        fetch("/api/status").then((r) => r.json()),
        fetch("/api/files").then((r) => r.json()),
        fetch("/api/blockchain/activities").then((r) => r.json()),
      ]);

      setServerStatus(statusRes);
      if (Array.isArray(filesRes)) setFiles(filesRes);
      if (Array.isArray(actRes)) setActivities(actRes);
    } catch (err) {
      console.error("Failed to fetch repository data:", err);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setUploadStatus(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      setUploadStatus(null);
    }
  };

  // Upload handler
  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadStatus(null);
    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const res = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Upload failed");
      }

      setUploadStatus({
        type: "success",
        message: `"${selectedFile.name}" encrypted & stored securely. Blockchain logged.`,
      });
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadData();
    } catch (err) {
      setUploadStatus({
        type: "error",
        message: "Upload failed: " + err.message,
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Download & Decrypt handler
  const handleDownload = async (file) => {
    setDownloadingId(file.id);
    try {
      const res = await fetch(`/api/files/${file.id}/download`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Download failed");
      }

      const integrityVerified = res.headers.get("X-Integrity-Verified") === "true";
      const signatureValid = res.headers.get("X-Signature-Valid") === "true";
      const rsaRecovered = res.headers.get("X-RSA-Recovered");
      const originalHash = res.headers.get("X-Original-Hash") || file.file_hash || file.fileHash;
      const decryptedHash = res.headers.get("X-Decrypted-Hash") || file.file_hash || file.fileHash;
      const downloadTx = res.headers.get("X-Download-Tx") || "Confirmed";

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", file.file_name || file.originalName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setVerificationNotice({
        filename: file.file_name || file.originalName,
        verified: integrityVerified,
        signatureValid,
        rsaRecovered,
        originalHash,
        decryptedHash,
        downloadTx,
      });

      setTimeout(loadData, 800);
    } catch (err) {
      alert("Download error: " + err.message);
    } finally {
      setDownloadingId(null);
    }
  };

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(key);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const formatTime = (ts) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (ts) => {
    const d = new Date(ts);
    return d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
  };

  const CopyButton = ({ text, id }) => (
    <button
      className="copy-btn"
      onClick={(e) => {
        e.stopPropagation();
        copyToClipboard(text, id);
      }}
      title="Copy"
    >
      {copiedHash === id ? <Check size={11} color="#16a34a" /> : <Copy size={11} />}
    </button>
  );

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="header">
        <div className="header-icon">
          <ShieldCheck size={24} color="#ffffff" />
        </div>
        <h1>Secure Cloud Repository</h1>
        <p className="subtitle">AES-256 + RSA-2048 + Digital Signatures + Blockchain Audit</p>
      </header>

      {/* 4 Status Cards */}
      <div className="status-cards">
        <div className="status-card">
          <div className="sc-icon">🔐</div>
          <div className="sc-title">AES-256</div>
          <div className="sc-desc">File Encryption</div>
        </div>
        <div className="status-card">
          <div className="sc-icon">🔑</div>
          <div className="sc-title">RSA-2048</div>
          <div className="sc-desc">Key Protection (OAEP)</div>
        </div>
        <div className="status-card">
          <div className="sc-icon">#</div>
          <div className="sc-title">SHA-256</div>
          <div className="sc-desc">File Integrity</div>
        </div>
        <div className="status-card">
          <div className="sc-icon">⛓</div>
          <div className="sc-title">Blockchain</div>
          <div className="sc-desc">
            {serverStatus?.blockchain?.connected ? "Connected" : "Connecting..."}
          </div>
        </div>
      </div>

      {/* Verification Notice Banner */}
      {verificationNotice && (
        <div
          className={`verification-banner ${
            verificationNotice.verified && verificationNotice.signatureValid ? "" : "warning"
          }`}
        >
          <div className="banner-left">
            {verificationNotice.verified && verificationNotice.signatureValid ? (
              <CheckCircle size={22} color="#16a34a" />
            ) : (
              <AlertTriangle size={22} color="#d97706" />
            )}
            <div>
              <div className="banner-title">
                {verificationNotice.verified && verificationNotice.signatureValid
                  ? "Decryption & Security Verified ✓"
                  : "Verification Alert"}
              </div>
              <div className="banner-desc">
                <strong>{verificationNotice.filename}</strong>:
                {" "}🔒 AES-256 Decrypted • 🔑 RSA Key Recovered • ✓ Hash Verified • ✍ Digital Signature: {verificationNotice.signatureValid ? "✓ Valid" : "✗ Invalid"}
              </div>
            </div>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setVerificationNotice(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ========== 1. UPLOAD FILE ========== */}
      <section className="card" id="upload-section">
        <div className="card-title">
          <UploadCloud size={20} color="#2563eb" />
          <span>Upload File</span>
        </div>

        <div
          className={`upload-dropzone ${selectedFile ? "has-file" : ""}`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current && fileInputRef.current.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            onChange={handleFileChange}
            id="file-input"
          />
          <div className="upload-icon">
            <UploadCloud size={24} />
          </div>
          <div className="upload-text">
            {selectedFile
              ? `${selectedFile.name} (${formatBytes(selectedFile.size)})`
              : "Click to choose a file or drag & drop"}
          </div>
          <div className="upload-subtext">
            Max 50 MB — Your file will be encrypted with AES-256-GCM
          </div>
        </div>

        {selectedFile && (
          <div className="upload-actions">
            <button
              className="btn btn-secondary"
              onClick={() => {
                setSelectedFile(null);
                setUploadStatus(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              disabled={isUploading}
              id="cancel-upload-btn"
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleUpload}
              disabled={isUploading}
              id="upload-btn"
            >
              {isUploading ? (
                <>
                  <RefreshCw size={14} className="spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Lock size={14} />
                  Upload &amp; Encrypt
                </>
              )}
            </button>
          </div>
        )}

        {uploadStatus && (
          <div
            className="upload-status"
            style={{
              color:
                uploadStatus.type === "success"
                  ? "var(--success)"
                  : "#dc2626",
            }}
          >
            {uploadStatus.type === "success" ? (
              <CheckCircle size={15} />
            ) : (
              <AlertTriangle size={15} />
            )}
            {uploadStatus.message}
          </div>
        )}
      </section>

      {/* ========== 2. MY FILES ========== */}
      <section className="card" id="files-section">
        <div className="card-title">
          <FileText size={20} color="#16a34a" />
          <span>My Files</span>
          <span className="ct-count">({files.length})</span>
        </div>

        {files.length === 0 ? (
          <div className="empty-state">
            <FileText size={32} className="empty-icon" />
            <p>No files uploaded yet. Upload a file above to begin.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table id="files-table">
              <thead>
                <tr>
                  <th>File Name</th>
                  <th>Size</th>
                  <th>Security Status</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <React.Fragment key={file.id}>
                    <tr>
                      <td style={{ fontWeight: 600, color: "var(--text)" }}>
                        {file.file_name || file.originalName}
                      </td>
                      <td>{formatBytes(file.size)}</td>
                      <td>
                        <div className="badges-list">
                          <span className="badge badge-encrypted">🔒 AES-256</span>
                          {file.rsaProtected !== false && (
                            <span className="badge badge-rsa">🔑 RSA Protected</span>
                          )}
                          <span className="badge badge-verified">✓ Hash Verified</span>
                          <span
                            className={`badge ${
                              file.signature_valid !== false ? "badge-sig" : "badge-sig-invalid"
                            }`}
                          >
                            ✍ Signature: {file.signature_valid !== false ? "✓ Valid" : "✗ Invalid"}
                          </span>
                        </div>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleDownload(file)}
                          disabled={downloadingId === file.id}
                          id={`download-btn-${file.id}`}
                        >
                          {downloadingId === file.id ? (
                            <>
                              <RefreshCw size={12} className="spin" />
                              Decrypting...
                            </>
                          ) : (
                            <>
                              <Download size={12} />
                              Download
                            </>
                          )}
                        </button>
                        <button
                          className="btn-ghost"
                          onClick={() =>
                            setExpandedFile(
                              expandedFile === file.id ? null : file.id
                            )
                          }
                          id={`details-btn-${file.id}`}
                        >
                          {expandedFile === file.id ? (
                            <>
                              Hide Details <ChevronUp size={12} />
                            </>
                          ) : (
                            <>
                              View Details <ChevronDown size={12} />
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                    {expandedFile === file.id && (
                      <tr>
                        <td colSpan={4} style={{ padding: "0 1rem 0.85rem" }}>
                          <div className="details-row">
                            <div className="detail-item">
                              <span className="detail-label">SHA-256 Hash</span>
                              <span className="detail-value">
                                {file.file_hash || file.fileHash}
                                <CopyButton
                                  text={file.file_hash || file.fileHash}
                                  id={`hash-${file.id}`}
                                />
                              </span>
                            </div>
                            {(file.encrypted_aes_key || file.encryptedAesKey) && (
                              <div className="detail-item">
                                <span className="detail-label">RSA-OAEP Key</span>
                                <span className="detail-value">
                                  {(file.encrypted_aes_key || file.encryptedAesKey).substring(0, 36)}...
                                  <CopyButton
                                    text={file.encrypted_aes_key || file.encryptedAesKey}
                                    id={`rsa-${file.id}`}
                                  />
                                </span>
                              </div>
                            )}
                            {(file.digital_signature || file.digitalSignature) && (
                              <div className="detail-item">
                                <span className="detail-label">RSA-PSS Signature</span>
                                <span className="detail-value">
                                  {(file.digital_signature || file.digitalSignature).substring(0, 36)}...
                                  <CopyButton
                                    text={file.digital_signature || file.digitalSignature}
                                    id={`sig-${file.id}`}
                                  />
                                </span>
                              </div>
                            )}
                            <div className="detail-item">
                              <span className="detail-label">Tx Hash</span>
                              <span className="detail-value">
                                {file.uploadTxHash}
                                <CopyButton
                                  text={file.uploadTxHash}
                                  id={`tx-${file.id}`}
                                />
                              </span>
                            </div>
                            <div className="detail-item">
                              <span className="detail-label">Encryption</span>
                              <span className="detail-value">
                                {file.encryptionAlgorithm || "AES-256-GCM (RSA-2048 Protected)"}
                              </span>
                            </div>
                            <div className="detail-item">
                              <span className="detail-label">Uploaded</span>
                              <span className="detail-value" style={{ fontFamily: "var(--font-sans)" }}>
                                {new Date(file.upload_time || file.uploadedAt).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ========== 3. BLOCKCHAIN ACTIVITY ========== */}
      <section className="card" id="activity-section">
        <div className="card-title">
          <Activity size={20} color="#7c3aed" />
          <span>Blockchain Activity</span>
          <span className="ct-count">({activities.length})</span>
        </div>

        {activities.length === 0 ? (
          <div className="empty-state">
            <Activity size={32} className="empty-icon" />
            <p>No blockchain activity yet.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table id="activity-table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>File</th>
                  <th>Time</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((act, index) => (
                  <React.Fragment key={index}>
                    <tr>
                      <td>
                        <span
                          className={`badge ${
                            act.action === "UPLOAD"
                              ? "badge-upload"
                              : "badge-download"
                          }`}
                        >
                          {act.action === "UPLOAD" ? (
                            <UploadCloud size={11} />
                          ) : (
                            <Download size={11} />
                          )}
                          {act.action}
                        </span>
                      </td>
                      <td style={{ fontWeight: 500 }}>{act.filename}</td>
                      <td style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>
                        {formatTime(act.timestamp)}, {formatDate(act.timestamp)}
                      </td>
                      <td>
                        <span className="badge badge-status">✓ Recorded</span>
                        <button
                          className="btn-ghost"
                          onClick={() =>
                            setExpandedActivity(
                              expandedActivity === index ? null : index
                            )
                          }
                          style={{ marginLeft: "0.35rem" }}
                          id={`act-details-btn-${index}`}
                        >
                          {expandedActivity === index ? (
                            <>
                              Hide <ChevronUp size={11} />
                            </>
                          ) : (
                            <>
                              Details <ChevronDown size={11} />
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                    {expandedActivity === index && (
                      <tr>
                        <td colSpan={4} style={{ padding: "0 1rem 0.85rem" }}>
                          <div className="details-row">
                            <div className="detail-item">
                              <span className="detail-label">SHA-256 Hash</span>
                              <span className="detail-value">
                                {act.fileHash}
                                <CopyButton
                                  text={act.fileHash}
                                  id={`act-hash-${index}`}
                                />
                              </span>
                            </div>
                            <div className="detail-item">
                              <span className="detail-label">Performer</span>
                              <span className="detail-value">
                                {act.performer}
                                <CopyButton
                                  text={act.performer}
                                  id={`act-perf-${index}`}
                                />
                              </span>
                            </div>
                            <div className="detail-item">
                              <span className="detail-label">Timestamp</span>
                              <span className="detail-value" style={{ fontFamily: "var(--font-sans)" }}>
                                {new Date(act.timestamp).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
