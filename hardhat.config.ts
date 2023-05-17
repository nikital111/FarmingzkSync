import { HardhatUserConfig } from "hardhat/config";
require("@matterlabs/hardhat-zksync-deploy");
require("@matterlabs/hardhat-zksync-solc");

// dynamically changes endpoints for local tests
const zkSyncTestnet = {
  url: "http://localhost:3050",
  ethNetwork: "http://localhost:8545",
  allowUnlimitedContractSize: true,
  zksync: true,
  name:"zkSync"
};
// process.env.NODE_ENV == "test"
//   ? {
//       url: "http://localhost:3050",
//       ethNetwork: "http://localhost:8545",
//       zksync: true,
//     }
//   : {
//       url: "https://zksync2-testnet.zksync.dev",
//       ethNetwork: "goerli",
//       zksync: true,
//     };

const config: HardhatUserConfig = {
  defaultNetwork: "zkSyncTestnet",
  networks: {
    hardhat: {
      // @ts-ignore
      zksync: true,
    },
    zkSyncTestnet,
  },
  solidity: {
    version: "0.8.18",
  },
};

export default config;
