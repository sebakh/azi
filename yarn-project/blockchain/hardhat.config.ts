import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-etherscan';

const config = {
  solidity: {
    version: '0.8.10',
    settings: {
      evmVersion: 'london',
      optimizer: { enabled: true, runs: 5000 },
    },
  },
  networks: {
    ganache: {
      url: `http://${process.env.GANACHE_HOST || 'localhost'}:8545`,
    },
    goerli: {
      url: 'https://goerli.infura.io/v3/6a04b7c89c5b421faefde663f787aa35',
    },
    hardhat: {
      allowUnlimitedContractSize: true,
      blockGasLimit: 15000000,
      hardfork: 'london',
    },
  },
  paths: {
    artifacts: './src/artifacts',
    tests: './src/contracts',
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};

export default config;