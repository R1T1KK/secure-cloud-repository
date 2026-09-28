const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
// Standard Hardhat Account #0 private key
const DEFAULT_PRIVATE_KEY =
  process.env.PRIVATE_KEY ||
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const configPath = path.resolve(__dirname, "../config/contractInfo.json");

function getContractInstance() {
  if (!fs.existsSync(configPath)) {
    throw new Error(
      "Contract configuration not found. Please deploy the smart contract first via 'npm run deploy' in blockchain folder."
    );
  }

  const contractInfo = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const signer = new ethers.Wallet(DEFAULT_PRIVATE_KEY, provider);
  const contract = new ethers.Contract(contractInfo.address, contractInfo.abi, signer);

  return { contract, signer, provider, address: contractInfo.address };
}

async function recordActivityOnChain(filename, fileHash, action) {
  try {
    const { contract } = getContractInstance();
    const tx = await contract.recordActivity(filename, fileHash, action);
    const receipt = await tx.wait();

    return {
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed ? receipt.gasUsed.toString() : "0",
    };
  } catch (error) {
    console.error("Blockchain record error:", error.message);
    return {
      success: false,
      error: error.message,
      txHash: "N/A (Blockchain offline or not deployed)",
    };
  }
}

async function getActivitiesFromChain() {
  try {
    const { contract } = getContractInstance();
    const rawActivities = await contract.getAllActivities();

    return rawActivities.map((act, index) => ({
      id: index,
      filename: act.filename,
      fileHash: act.fileHash,
      action: act.action,
      timestamp: Number(act.timestamp) * 1000, // convert sec to ms
      performer: act.performer,
    })).reverse(); // newest first
  } catch (error) {
    console.error("Fetch activities error:", error.message);
    return [];
  }
}

async function checkBlockchainStatus() {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const network = await provider.getNetwork();
    const blockNumber = await provider.getBlockNumber();
    const contractExists = fs.existsSync(configPath);
    let contractAddress = null;
    if (contractExists) {
      const contractInfo = JSON.parse(fs.readFileSync(configPath, "utf8"));
      contractAddress = contractInfo.address;
    }

    return {
      connected: true,
      chainId: Number(network.chainId),
      blockNumber,
      contractAddress,
    };
  } catch (error) {
    return {
      connected: false,
      error: error.message,
    };
  }
}

module.exports = {
  recordActivityOnChain,
  getActivitiesFromChain,
  checkBlockchainStatus,
};
