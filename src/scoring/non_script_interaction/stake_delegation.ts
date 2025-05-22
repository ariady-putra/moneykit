// type: stake_delegation
// description: Delegated stake to pool: {[TICKER] PoolName | PoolName} | Stake Delegation

import { Account, Transaction } from "../../types/manifest";
import { AddressDetails } from "@lucid-evolution/lucid";
import { AddressInfo, PoolMetadata, TransactionInfo, TransactionUTXOs } from "../../util/blockfrost";
import { bf, lucid } from "../../util/_";
import { CalculatedScore, TransactionScore } from "../../types/_";

// txInfo.delegation_count > 0
// user.total currency:ADA amount:-#.##
// other.role.length === 0
// no metadata
const weighting = {
  stakeDelegation: .50,
  userAccounts: .35,
  otherAccounts: .10,
  metadata: .05,
};

export async function score(
  { accounts, metadata }: Transaction,
  bfAddressInfo: AddressInfo,
  lucidAddressDetails: AddressDetails,
  txInfo: TransactionInfo,
  txUTXOs: TransactionUTXOs,
): Promise<TransactionScore> {
  const weights = await Promise.all([
    calcW0(txInfo, lucidAddressDetails.stakeCredential?.hash),
    calcW1(accounts.user),
    calcW2(accounts.other),
    calcW3(metadata),
  ]);

  const [, poolMetadata] = weights[0];
  const poolTicker =
    poolMetadata?.ticker
      ? `[${poolMetadata.ticker}]`
      : undefined;
  const poolName =
    poolMetadata?.name
      ? (poolTicker ?
        `${poolTicker} ${poolMetadata.name}`
        : poolMetadata.name)
      : undefined;
  const description = poolName ? `Delegated stake to pool: ${poolName}` : "Stake Delegation";
  const type = "stake_delegation";

  const score = weights.reduce(
    (sum, [weight]) => sum + weight,
    0,
  );

  return { type, description, score };
}

/**
 * Delegation count must be greater than 0. There may or may not be stake certs.
 * @param txInfo Blockfrost TxInfo
 * @param stakeAddress The User Bech32 StakeAddress
 */
async function calcW0(
  txInfo: TransactionInfo,
  stakeAddress?: string,
): Promise<CalculatedScore<PoolMetadata | undefined>> {
  if (!stakeAddress) return [0, undefined];

  try {
    if (txInfo.delegation_count) {
      const delegations = await bf.getTransactionDelegations(txInfo.hash);
      for (const { address, pool_id } of delegations) {
        const sk = await lucid.stakeCredentialOf(address);
        if (sk?.hash === stakeAddress) {
          const poolMetadata = await bf.getPoolMetadata(pool_id);
          return [weighting.stakeDelegation, poolMetadata];
        }
      }
    }
    return [weighting.stakeDelegation / 2, undefined]; // has delegation_count, but somehow failed to get pool metadata
  } catch {
    return [0, undefined];
  }
}

/**
 * There may be more than 1 associated addresses, but the AGGREGATE movement should only be ADA.
 * @param user User Accounts
 * @returns [Score, AdditionalData]
 */
async function calcW1(user: Account[]): Promise<CalculatedScore<undefined>> {
  const assets = user.reduce(
    (sum, { total }) => {
      total.reduce(
        (sum, { currency, amount }) => {
          sum[currency] = (sum[currency] ?? 0) + amount;
          return sum;
        },
        sum,
      );
      return sum;
    },
    {} as Record<string, number>,
  );

  const currencies = Object.keys(assets);
  if (!currencies.length || assets.ADA > 0) return [0, undefined];

  const adaCount = currencies.filter(
    (currency) =>
      currency === "ADA"
  ).length;

  const withMovement = currencies.filter(
    (currency) =>
      assets[currency]
  ).length;

  return [weighting.userAccounts * adaCount / withMovement, undefined];
}

/**
 * Usually no other accounts, unless the address has other associated addresses.
 * @param other Other Accounts
 * @returns [Score, AdditionalData]
 */
async function calcW2(other: Account[]): Promise<CalculatedScore<undefined>> {
  return [other.length ? 0 : weighting.otherAccounts, undefined];
}

/**
 * The sender can optionally put some arbitrary metadata though.
 * @param metadata Transaction Metadata
 * @returns [Score, AdditionalData]
 */
async function calcW3(metadata: Record<string, any>[]): Promise<CalculatedScore<undefined>> {
  return [metadata.length ? 0 : weighting.metadata, undefined];
}
