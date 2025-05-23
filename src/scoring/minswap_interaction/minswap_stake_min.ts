// type: PASSTHROUGH | amm_dex
// description: Staked #.## MIN on Minswap

import { Account, Transaction } from "../../types/manifest";
import { AddressDetails } from "@lucid-evolution/lucid";
import { AddressInfo, TransactionInfo, TransactionUTXOs } from "../../util/blockfrost";
import { CalculatedScore, TransactionScore } from "../../types/_";
import { util } from "../../util/_";

// user.total with negative Minswap
// other.role there's a Minswap Min staking... with positive Minswap
// metadata { label:"674", json_metadata:{ msg:"Minswap: Stake MIN" } }
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
    ? `Staked ${minswap} MIN on Minswap`
    : `Staked MIN on Minswap`;
  const type = intermediaryTx.type === `${undefined}` ? "amm_dex" : intermediaryTx.type;

  const score = weights.reduce(
    (sum, [weight]) => sum + weight,
    0,
  );

  return { type, description, score };
}

/**
 * There should be a negative Minswap.
 * @param user User Accounts
 * @returns [Score, AdditionalData]
 */
async function calcW1(user: Account[]): Promise<CalculatedScore<number>> {
  const minswap = user.reduce(
    (sum, { total }) =>
      total.reduce(
        (sum, { currency, amount }) => {
          if (currency === "Minswap")
            sum -= amount;
          return sum;
        },
        sum,
      ),
    0,
  );
  return [minswap > 0 ? weighting.userAccounts : 0, minswap];
}

/**
 * There should be a script or Minswap Min staking... with positive Minswap.
 * @param other Other Accounts
 * @returns [Score, AdditionalData]
 */
async function calcW2(other: Account[]): Promise<CalculatedScore<undefined>> {
  return [other.find(
    ({ role, total }) =>
      (role.toUpperCase().startsWith("MINSWAP MIN STAKING") || role === "Unknown Script")
      && total.find(
        ({ currency, amount }) =>
          currency === "Minswap" && amount > 0
      )
  ) ? weighting.otherAccounts : 0, undefined];
}

/**
 * There should be metadata with msg:"Minswap: Stake MIN"
 * @param metadata Transaction Metadata
 * @returns [Score, AdditionalData]
 */
async function calcW3(metadata: Record<string, any>[]): Promise<CalculatedScore<undefined>> {
  return [util.weighMetadataMsg("674", "Minswap Stake MIN".split(" "), metadata) * weighting.metadata, undefined];
}
