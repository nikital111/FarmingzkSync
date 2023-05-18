process.env.NODE_ENV = "zkSync";
import { HardhatUserConfig } from "hardhat/config";
require("@nomicfoundation/hardhat-toolbox");
require("@matterlabs/hardhat-zksync-toolbox");
require("@matterlabs/hardhat-zksync-deploy");
require("@matterlabs/hardhat-zksync-solc");
require("@matterlabs/hardhat-zksync-chai-matchers");

const zkSyncTestnet = {
  url: "http://localhost:3050",
  ethNetwork: "http://localhost:8545",
  zksync: true,
};

const config: HardhatUserConfig = {
  defaultNetwork:
    process.env.NODE_ENV == "zkSync" ? "zkSyncTestnet" : "hardhat",
  networks: {
    hardhat: {
      // @ts-ignore
      zksync: false,
    },
    zkSyncTestnet,
  },
  solidity: {
    version: "0.8.18",
  },
};

export default config;
