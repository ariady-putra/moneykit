// type: PASSTHROUGH | amm_dex
// description: Received {#.## TokenA | and #.## TokenB} as staking rewards from Minswap

import { Account, Transaction } from "../../types/manifest";
import { AddressDetails } from "@lucid-evolution/lucid";
import { AddressInfo, TransactionInfo, TransactionUTXOs } from "../../util/blockfrost";
import { CalculatedScore, TransactionScore } from "../../types/_";
import { util } from "../../util/_";

// user accounts to construct the received tokens
// metadata { label:"674", json_metadata:{ msg:"Minswap: ... staking rewards" } }
const weighting = {
  userAccounts: .10,
  metadata: .90,
};

export async function score(
  intermediaryTx: Transaction,
  bfAddressInfo: AddressInfo,
  lucidAddressDetails: AddressDetails,
  txInfo: TransactionInfo,
  txUTXOs: TransactionUTXOs,
): Promise<TransactionScore> {
  const weights = await Promise.all([
    calcW1(intermediaryTx.accounts.user),
    calcW2(intermediaryTx.metadata),
  ]);

  const [, userTokens] = weights[0];

  const currencies = Object.keys(userTokens);
  const receivedTokens = currencies.map(
    (currency) =>
      util.formatAmount(userTokens[currency], currency),
  );

  const description = currencies.length
    ? `Received ${util.joinWords(receivedTokens)} as staking rewards from Minswap`
    : "Received staking rewards from Minswap";
  const type = intermediaryTx.type === `${undefined}` ? "amm_dex" : intermediaryTx.type;

  const score = weights.reduce(
    (sum, [weight]) => sum + weight,
    0,
  );

  return { type, description, score };
}

/**
 * Just to provide the received tokens.
 * @param user User Accounts
 * @returns [Score, AdditionalData]
 */
async function calcW1(user: Account[]): Promise<CalculatedScore<Record<string, number>>> {
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
  return [Object.keys(assets).length ? weighting.userAccounts : 0, assets];
}

/**
 * There should be metadata with msg:"Minswap: ... staking rewards"
 * @param metadata Transaction Metadata
 * @returns [Score, AdditionalData]
 */
async function calcW2(metadata: Record<string, any>[]): Promise<CalculatedScore<undefined>> {
  return [util.weighMetadataMsg("674", "Minswap staking rewards".split(" "), metadata) * weighting.metadata, undefined];
}
