import { AccountId } from '@aztec/barretenberg/account_id';
import { AssetValue } from '@aztec/barretenberg/asset';
import { TxId } from '@aztec/barretenberg/tx_id';
import { CoreSdk } from '../core_sdk/core_sdk';
import { ProofOutput } from '../proofs';
import { Signer } from '../signer';
import { createTxRefNo } from './create_tx_ref_no';
import { filterUndefined } from './filter_undefined';

export class TransferController {
  private proofOutput!: ProofOutput;
  private feeProofOutput?: ProofOutput;
  private txIds!: TxId[];

  constructor(
    public readonly userId: AccountId,
    private readonly userSigner: Signer,
    public readonly assetValue: AssetValue,
    public readonly fee: AssetValue,
    public readonly to: AccountId,
    private readonly core: CoreSdk,
  ) {}

  public async createProof() {
    const { assetId, value } = this.assetValue;
    const requireFeePayingTx = this.fee.value && this.fee.assetId !== assetId;
    const privateInput = value + (!requireFeePayingTx ? this.fee.value : BigInt(0));
    const txRefNo = requireFeePayingTx ? createTxRefNo() : 0;

    this.proofOutput = await this.core.createPaymentProof(
      this.userId,
      this.userSigner,
      assetId,
      BigInt(0),
      BigInt(0),
      privateInput,
      value,
      BigInt(0),
      this.to,
      undefined,
      2,
      txRefNo,
    );

    if (requireFeePayingTx) {
      this.feeProofOutput = await this.core.createPaymentProof(
        this.userId,
        this.userSigner,
        this.fee.assetId,
        BigInt(0),
        BigInt(0),
        this.fee.value,
        BigInt(0),
        BigInt(0),
        undefined,
        undefined,
        2,
        txRefNo,
      );
    }
  }

  async send() {
    this.txIds = await this.core.sendProofs(filterUndefined([this.proofOutput, this.feeProofOutput]));
    return this.txIds[0];
  }

  async awaitSettlement(timeout?: number) {
    await Promise.all(this.txIds.map(txId => this.core.awaitSettlement(txId, timeout)));
  }
}