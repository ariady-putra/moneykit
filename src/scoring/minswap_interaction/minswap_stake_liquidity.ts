// type: yield_farming | PASSTHROUGH
// description: Staked {TokenName | liquidity} on Minswap

import { Account, Transaction } from "../../types/manifest";
import { AddressDetails } from "@lucid-evolution/lucid";
import { AddressInfo, TransactionInfo, TransactionUTXOs } from "../../util/blockfrost";
import { bf, lucid, util } from "../../util/_";
import { CalculatedScore, TransactionScore } from "../../types/_";

// user.total with negative asset100000000000000000000000000000000000044
// other.role there's a Minswap Yield Farming... with positive asset100000000000000000000000000000000000044
// metadata { label:"674", json_metadata:{ msg:"Minswap: .. Stake liquidity" } }
const weighting = {
  userAccounts: .40,
  otherAccounts: .50,
  metadata: .10,
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
    calcW2(intermediaryTx.accounts.other, txUTXOs),
    calcW3(intermediaryTx.metadata),
  ]);

  const [, tokenName] = weights[1];

  const description = `Staked ${tokenName ?? "liquidity"} on Minswap`;
  const type = tokenName ? "yield_farming" : intermediaryTx.type;

  const score = weights.reduce(
    (sum, [weight]) => sum + weight,
    0,
  );

  return { type, description, score };
}

/**
 * There should be an asset100000000000000000000000000000000000044 with negative amount.
 * @param user User Accounts
 * @returns [Score, AdditionalData]
 */
async function calcW1(user: Account[]): Promise<CalculatedScore<undefined>> {
  const assets = user.reduce(
    (sum, { total }) => {
      total.reduce(
        (sum, { currency, amount }) => {
          if ((currency.endsWith(" LP") || (currency.startsWith("asset") && currency.length === 44)) && amount < 0)
            sum[currency] = (sum[currency] ?? 0) + amount;
          return sum;
        },
        sum,
      );
      return sum;
    },
    {} as Record<string, number>,
  );
  return [Object.keys(assets).length ? weighting.userAccounts : 0, undefined];
}

/**
 * There should be a Minswap Yield Farming... with positive asset100000000000000000000000000000000000044,
 * if there's no other account then score:0
 * 
 * The Minswap Yield Farming contains the token name information in the output datum.
 * 
 * @param other Other Accounts
 * @param txUTXOs Blockfrost Transaction UTXOs
 * @returns [Score, AdditionalData]
 */
async function calcW2(
  other: Account[],
  txUTXOs: TransactionUTXOs,
): Promise<CalculatedScore<string | undefined>> {
  if (!other.length) return [0, undefined];

  let stakedToken: string | undefined = undefined;
  for (const { address, role } of other) {
    try {
      if (role.startsWith("Minswap Yield Farming")) {
        const utxo = txUTXOs.outputs.find(
          (input) =>
            input.address === address
        );
        if (!utxo?.data_hash) continue;

        const { json_value } = await bf.getDatum(utxo.data_hash);
        stakedToken = await lucid.toText(json_value.fields[3].list[0].fields[0].fields[1].bytes);
        if (stakedToken) break;
      }
    } catch {
      continue;
    }
  }

  return [stakedToken ? weighting.otherAccounts : 0, stakedToken];
}

/**
 * There should be metadata with msg:"Minswap: .. Stake liquidity"
 * @param metadata Transaction Metadata
 * @returns [Score, AdditionalData]
 */
async function calcW3(metadata: Record<string, any>[]): Promise<CalculatedScore<undefined>> {
  return [util.weighMetadataMsg("674", "Minswap Stake liquidity".split(" "), metadata) * weighting.metadata, undefined];
}
