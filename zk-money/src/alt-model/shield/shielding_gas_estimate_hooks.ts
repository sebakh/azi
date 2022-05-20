import createDebug from 'debug';
import { useEffect, useMemo, useState } from 'react';
import { EthAddress } from '@aztec/sdk';
import { Contract } from '@ethersproject/contracts';
import { useStableEthereumProvider, useGasUnitPrice } from 'alt-model/top_level_context';
import { createGatedSetter, listenPoll } from 'app/util';
import { useRollupProviderStatus } from '../rollup_provider_hooks';

const debug = createDebug('zm:fee_hooks');

const ROLLUP_ABI = [
  {
    inputs: [
      {
        internalType: 'uint256',
        name: 'assetId',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'amount',
        type: 'uint256',
      },
      {
        internalType: 'address',
        name: 'depositorAddress',
        type: 'address',
      },
    ],
    name: 'depositPendingFunds',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  'function approveProof(bytes32 _proofHash)',
];

async function getDepositFundsGasEstimate(contract: Contract, fromAddressStr: string, assetId: number) {
  try {
    // A non-zero value indicates some token is has to be transfered
    const value = assetId === 0 ? 0n : 1n;
    const gas = await contract.estimateGas.depositPendingFunds(assetId, 1n, fromAddressStr, { value });
    return BigInt(gas.toString());
  } catch (e) {
    debug(e);
    // Probably not enough balance.
    return 70000n;
  }
}

async function getApproveProofGasEstimate(contract: Contract) {
  const proofHash = '0x'.padEnd(66, '0');
  try {
    const bigNumber = await contract.estimateGas.approveProof(proofHash);
    return BigInt(bigNumber.toString());
  } catch (e) {
    debug(e);
    // Probably not enough balance.
    return 50000n;
  }
}

function costPlus10Percent(gas?: bigint, gasUnitPrice?: bigint) {
  if (gas === undefined || gasUnitPrice === undefined) return undefined;
  return (gas * gasUnitPrice * 110n) / 100n;
}

const POLL_INTERVAL = 1000 * 60 * 10;

export function useEstimatedShieldingGasCosts(depositor?: EthAddress, assetId?: number) {
  const stableEthereumProvider = useStableEthereumProvider();
  const gasUnitPrice = useGasUnitPrice();
  const rpStatus = useRollupProviderStatus();
  const contractAddress = rpStatus?.blockchainStatus.feeDistributorContractAddress.toString();
  const [depositFundsGas, setDepositFundsGas] = useState<bigint>();
  const [approveProofGas, setApproveProofGas] = useState<bigint>();
  const contract = useMemo(() => {
    if (contractAddress) {
      return new Contract(contractAddress, ROLLUP_ABI, stableEthereumProvider);
    }
  }, [stableEthereumProvider, contractAddress]);
  useEffect(() => {
    setApproveProofGas(undefined);
    if (contract) {
      return listenPoll(() => getApproveProofGasEstimate(contract).then(setApproveProofGas), POLL_INTERVAL);
    }
  }, [contract]);
  const fromAddressStr = depositor?.toString();
  useEffect(() => {
    setDepositFundsGas(undefined);
    if (contract && fromAddressStr && assetId !== undefined) {
      const gatedSetter = createGatedSetter(setDepositFundsGas);
      const unlisten = listenPoll(
        () => getDepositFundsGasEstimate(contract, fromAddressStr, assetId).then(gatedSetter.set),
        POLL_INTERVAL,
      );
      return () => {
        gatedSetter.close();
        unlisten();
      };
    }
  }, [contract, fromAddressStr, assetId]);

  return {
    depositFundsGasCost: costPlus10Percent(depositFundsGas, gasUnitPrice),
    approveProofGasCost: costPlus10Percent(approveProofGas, gasUnitPrice),
  };
}