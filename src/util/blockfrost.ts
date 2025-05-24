import { env } from "process";
import { cache } from "./_";

const { BF_PID, BF_URL } = env;

type BfError = {
  status_code?: number;
  error?: string;
  message?: string;
};

async function req<Data>(path: string, cacheTimeoutSec: number = 60_000) {
  const key = `bf.${path}`;
  const data = cache.get<Data>(key);
  if (data) return data;

  const resp: Response = await fetch(`${BF_URL}${path}`, { headers: { project_id: `${BF_PID}` } });
  const json: Data = await resp.json();

  cache.set<Data>(key, json, cacheTimeoutSec);
  return json;
}

//#region Blockfrost Types
type BfAmount = {
  unit: string;
  quantity: string;
};

type BfTransaction = {
  tx_hash: string;
  tx_index: number;
  block_height: number;
  block_time: number;
};

type BfUTxO = {
  address: string;
  amount: BfAmount[];
  tx_hash: string;
  output_index: number;
  data_hash: string | null;
  inline_datum: string | null;
  reference_script_hash: string | null;
  collateral: boolean;
  reference: boolean;
};

type BfMetadata = {
  label: string;
  json_metadata: any;
};

type BfDelegation = {
  index: number;
  cert_index: number;
  address: string;
  pool_id: string;
  active_epoch: number;
};

type BfWithdrawal = {
  address: string;
  amount: string;
};

/** Off-chain metadata fetched from GitHub based on network:
 * - Mainnet: https://github.com/cardano-foundation/cardano-token-registry/
 * - Testnet: https://github.com/input-output-hk/metadata-registry-testnet/
 */
type OffChainMetadata = {
  name: string;
  description?: string;
  ticker: string | null;
  url: string | null;
  logo: string | null;
  decimals: number | null;
};
//#endregion

//#region Address Info
export type AddressInfo = BfError & {
  address: string;
  amount: BfAmount[];
  stake_address: string | null;
  type: string;
  script: boolean;
};
export const getAddressInfo =
  (address: string) =>
    req<AddressInfo>(`/addresses/${address}`);
//#endregion

//#region Address Transactions
export type AddressTransactions = BfError & BfTransaction[];
export const getAddressTransactions =
  (address: string) =>
    req<AddressTransactions>(`/addresses/${address}/transactions?order=desc`, 60);
//#endregion

//#region Transaction Info
export type TransactionInfo = BfError & {
  hash: string;
  block: string;
  block_height: number;
  block_time: number;
  slot: number;
  index: number;
  output_amount: BfAmount[];
  fees: string;
  deposit: string;
  size: number;
  invalid_before: string | null;
  invalid_hereafter: string | null;
  utxo_count: number;
  withdrawal_count: number;
  mir_cert_count: number;
  delegation_count: number;
  stake_cert_count: number;
  pool_update_count: number;
  pool_retire_count: number;
  asset_mint_or_burn_count: number;
  redeemer_count: number;
  valid_contract: boolean;
};
export const getTransactionInfo =
  (hash: string) =>
    req<TransactionInfo>(`/txs/${hash}`);
//#endregion

//#region Transaction UTXOs
export type TransactionUTXOs = BfError & {
  hash: string;
  inputs: BfUTxO[];
  outputs: BfUTxO[];
};
export const getTransactionUTXOs =
  (hash: string) =>
    req<TransactionUTXOs>(`/txs/${hash}/utxos`);
//#endregion

//#region Transaction Metadata
export type TransactionMetadata = BfError & BfMetadata[];
export const getTransactionMetadata =
  (hash: string) =>
    req<TransactionMetadata>(`/txs/${hash}/metadata`);
//#endregion

//#region Transaction Delegations
export type TransactionDelegations = BfError & BfDelegation[];
export const getTransactionDelegations =
  (hash: string) =>
    req<TransactionDelegations>(`/txs/${hash}/delegations`);
//#endregion

//#region Transaction Withdrawals
export type TransactionWithdrawals = BfError & BfWithdrawal[];
export const getTransactionWithdrawals =
  (hash: string) =>
    req<TransactionWithdrawals>(`/txs/${hash}/withdrawals`);
//#endregion

//#region Asset Info
export type AssetInfo = BfError & {
  asset: string;
  policy_id: string;
  asset_name: string | null;
  fingerprint: string | null;
  quantity: string;
  initial_mint_tx_hash: string;
  mint_or_burn_count: number;
  onchain_metadata?: any;
  onchain_metadata_standard?: string | null;
  onchain_metadata_extra?: string | null;
  metadata?: OffChainMetadata;
};
export const getAssetInfo =
  (unit: string) =>
    req<AssetInfo>(`/assets/${unit}`);
//#endregion

//#region Datum
export type ScriptDatum = BfError & {
  json_value: any;
};
export const getDatum =
  (hash: string) =>
    req<ScriptDatum>(`/scripts/datum/${hash}`);
//#endregion

//#region Pool Metadata
export type PoolMetadata = BfError & {
  pool_id: string;
  hex: string;
  url: string | null;
  hash: string | null;
  ticker: string | null;
  name: string | null;
  description: string | null;
  homepage: string | null;
};
export const getPoolMetadata =
  (id: string) =>
    req<PoolMetadata>(`/pools/${id}/metadata`);
//#endregion
