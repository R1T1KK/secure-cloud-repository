const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Deploying FileActivity contract...");
  const FileActivity = await hre.ethers.getContractFactory("FileActivity");
  const fileActivity = await FileActivity.deploy();
  await fileActivity.waitForDeployment();

  const contractAddress = await fileActivity.getAddress();
  console.log(`FileActivity deployed successfully at: ${contractAddress}`);

  // Path to save contract info for server
  const serverConfigDir = path.resolve(__dirname, "../../server/config");
  if (!fs.existsSync(serverConfigDir)) {
    fs.mkdirSync(serverConfigDir, { recursive: true });
  }

  const contractArtifact = await hre.artifacts.readArtifact("FileActivity");
  const contractInfo = {
    address: contractAddress,
    abi: contractArtifact.abi,
    network: hre.network.name,
    deployedAt: new Date().toISOString(),
  };

  const outputPath = path.join(serverConfigDir, "contractInfo.json");
  fs.writeFileSync(outputPath, JSON.stringify(contractInfo, null, 2));
  console.log(`Contract info saved to: ${outputPath}`);
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
