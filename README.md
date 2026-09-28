# Secure Cloud Repository (College Demo MVP)

A working college demo project demonstrating end-to-end file encryption, integrity verification, and blockchain audit logging.

---

## 🛠️ Stack

- **Frontend**: React + Vite + Lucide Icons
- **Backend**: Node.js + Express
- **Cryptography**: Node built-in `crypto` (AES-256-GCM authenticated encryption + SHA-256 integrity hashing)
- **Storage**: Local encrypted file storage (`server/uploads/`) + JSON metadata (`server/data/metadata.json`)
- **Blockchain**: Hardhat local node + Solidity (`FileActivity.sol`) + ethers.js

---

## 🔄 How the Flow Works

1. **Upload**: User selects a file in React dashboard.
2. **Hash**: Server computes the original file's **SHA-256** hash.
3. **Encrypt**: Server encrypts file with **AES-256-GCM** using a random IV and generates an authentication tag.
4. **Store**: Encrypted `.enc` file is stored locally in `server/uploads/`.
5. **Blockchain Log (UPLOAD)**: Smart contract records `filename`, `fileHash`, `action: "UPLOAD"`, and timestamp.
6. **Dashboard Display**: Shows uploaded file name, SHA-256 hash, AES-256-GCM encryption status, and upload transaction hash.
7. **Download**: User clicks "Decrypt & Download".
8. **Decrypt & Verify**: Server decrypts the file, recalculates the SHA-256 hash of decrypted bytes, and verifies it matches the original hash.
9. **Blockchain Log (DOWNLOAD)**: Smart contract logs `action: "DOWNLOAD"`.
10. **Delivery**: Original decrypted file is sent back to the browser with verification headers, and the dashboard confirms integrity.

---

## 🚀 Exact Commands to Run

Open **3 separate terminals** in the project root directory:

### Terminal 1 — Blockchain Node
```bash
cd blockchain
npx hardhat node
```
*(Keep this running. Once running, in another tab or after first start, deploy contract:)*
```bash
cd blockchain
npx hardhat run scripts/deploy.js --network localhost
```

### Terminal 2 — Backend Server
```bash
cd server
npm start
```
*(Runs on `http://localhost:5000`)*

### Terminal 3 — Frontend Client
```bash
cd client
npm run dev
```
*(Opens at `http://localhost:3000`)*

---

## 📁 Project Structure

```text
Secure-Cloud-Repository/
├── blockchain/
│   ├── contracts/
│   │   └── FileActivity.sol       # Smart contract recording UPLOAD & DOWNLOAD
│   ├── scripts/
│   │   └── deploy.js              # Deploys contract & exports address + ABI
│   ├── hardhat.config.js
│   └── package.json
├── server/
│   ├── config/
│   │   └── contractInfo.json      # Auto-generated contract address & ABI
│   ├── data/
│   │   └── metadata.json          # File records, hashes, IVs, tags
│   ├── uploads/                   # Stored AES-256-GCM encrypted files
│   ├── utils/
│   │   ├── crypto.js              # AES-256-GCM and SHA-256 implementation
│   │   └── blockchain.js          # ethers.js interaction with Hardhat node
│   ├── server.js                  # Express API endpoints
│   └── package.json
├── client/
│   ├── src/
│   │   ├── App.jsx                # Single-page dashboard
│   │   ├── index.css              # Styling
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── README.md
```
