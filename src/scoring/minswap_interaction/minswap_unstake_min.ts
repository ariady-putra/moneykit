// type: PASSTHROUGH | amm_dex
// description: Unstaked #.## MIN from Minswap

import { Account, Transaction } from "../../types/manifest";
import { AddressDetails } from "@lucid-evolution/lucid";
import { AddressInfo, TransactionInfo, TransactionUTXOs } from "../../util/blockfrost";
import { CalculatedScore, TransactionScore } from "../../types/_";
import { util } from "../../util/_";

// user.total with positive Minswap
// other.role there's a Minswap Min staking... with negative Minswap
// metadata { label:"674", json_metadata:{ msg:"Minswap: Unstake MIN" } }
const weighting = {
  userAccounts: .40,
  otherAccounts: .10,
  metadata: .50,
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
    calcW2(intermediaryTx.accounts.other),
    calcW3(intermediaryTx.metadata),
  ]);

  const [, minswap] = weights[0];

  const description = minswap > 0
    ? `Unstaked ${minswap} MIN from Minswap`
    : "Unstaked MIN from Minswap";
  const type = intermediaryTx.type === `${undefined}` ? "amm_dex" : intermediaryTx.type;

  const score = weights.reduce(
    (sum, [weight]) => sum + weight,
    0,
  );

  return { type, description, score };
}

/**
 * There should be a positive Minswap.
 * @param user User Accounts
 * @returns [Score, AdditionalData]
 */
async function calcW1(user: Account[]): Promise<CalculatedScore<number>> {
  const minswap = user.reduce(
    (sum, { total }) =>
      total.reduce(
        (sum, { currency, amount }) => {
          if (currency === "Minswap")
            sum += amount;
          return sum;
        },
        sum,
      ),
    0,
  );
  return [minswap > 0 ? weighting.userAccounts : 0, minswap];
}

/**
 * There should be a Minswap Min staking... with negative Minswap.
 * @param other Other Accounts
 * @returns [Score, AdditionalData]
 */
async function calcW2(other: Account[]): Promise<CalculatedScore<undefined>> {
  return [other.find(
    ({ role, total }) =>
      role.toUpperCase().startsWith("MINSWAP MIN STAKING") && total.find(
        ({ currency, amount }) =>
          currency === "Minswap" && amount < 0
      )
  ) ? weighting.otherAccounts : 0, undefined];
}

/**
 * There should be metadata with msg:"Minswap: Unstake MIN"
 * @param metadata Transaction Metadata
 * @returns [Score, AdditionalData]
 */
async function calcW3(metadata: Record<string, any>[]): Promise<CalculatedScore<undefined>> {
  return [util.weighMetadataMsg("674", "Minswap Unstake MIN".split(" "), metadata) * weighting.metadata, undefined];
}
