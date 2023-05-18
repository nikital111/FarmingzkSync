import * as dotenv from "dotenv";
dotenv.config();

import { Wallet, utils } from "zksync-web3";
import * as ethers from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";

// npx hardhat deploy-zksync --script deploy --network zkTestnet
export default async function (hre: HardhatRuntimeEnvironment) {
  const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

  if (!PRIVATE_KEY) {
    throw new Error("Please set ZKS_PRIVATE_KEY in the environment variables.");
  }

  const wallet = new Wallet(PRIVATE_KEY);

  const deployer = new Deployer(hre, wallet);

  const artifactToken0 = await deployer.loadArtifact("TestTokenReward");
  const artifactToken1 = await deployer.loadArtifact("TestToken");
  const artifactFarming = await deployer.loadArtifact("Farming");

  const contractToken0 = await deployer.deploy(artifactToken0, ["A", "A"]);
  const addrToken0 = contractToken0.address;

  const contractToken1 = await deployer.deploy(artifactToken1, ["B", "B"]);
  const addrToken1 = contractToken1.address;

  const contractFarming = await deployer.deploy(artifactFarming, [
    addrToken0,
    addrToken1,
    100000,
  ]);
  const addrFarming = contractFarming.address;
  console.log(addrToken0, addrToken1, addrFarming);
}
