require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    // Flare Testnet (Coston2)
    flare: {
      url: process.env.FLARE_RPC || "https://coston2-api.flare.network/ext/C/rpc",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 114
    },
    // Plasma Testnet
    plasma: {
      url: process.env.PLASMA_RPC || "https://rpc-testnet.plasma.xyz",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 9746
    },
    hardhat: {
      chainId: 1337
    }
  },
  etherscan: {
    apiKey: {
      flare: process.env.FLARE_API_KEY || "",
      plasma: process.env.PLASMA_API_KEY || ""
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};
