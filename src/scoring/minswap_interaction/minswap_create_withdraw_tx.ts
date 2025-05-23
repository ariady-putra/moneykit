// type: PASSTHROUGH | amm_dex
// description: Created a withdraw XXX-YYY order on Minswap

import { Account, Transaction } from "../../types/manifest";
import { AddressDetails } from "@lucid-evolution/lucid";
import { AddressInfo, TransactionInfo, TransactionUTXOs } from "../../util/blockfrost";
import { CalculatedScore, TransactionScore } from "../../types/_";
import { lucid, util } from "../../util/_";

// user script address with positive LPs and non-script address with negative LPs
// metadata { label:"674", json_metadata:{ msg:"Minswap: Withdraw Order" } }
const weighting = {
  userAccounts: .50,
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
    calcW2(intermediaryTx.metadata),
  ]);

  const [, pairTokens] = weights[0];

  const description = pairTokens
    ? `Created a withdraw ${pairTokens} order on Minswap`
    : "Created a withdraw order on Minswap";
  const type = intermediaryTx.type === `${undefined}` ? "amm_dex" : intermediaryTx.type;

  const score = weights.reduce(
    (sum, [weight]) => sum + weight,
    0,
  );

  return { type, description, score };
}

/**
 * There must be a user script address with positive LP amounts,
 * and a non-script address with negative LP amounts.
 * 
 * @param user User Accounts
 * @returns [Score, AdditionalData]
 */
async function calcW1(user: Account[]): Promise<CalculatedScore<string | undefined>> {
  const scriptTotal: Record<string, number> = {};
  const nonScriptTotal: Record<string, number> = {};
  const lpTokens = new Set<string>();

  for (const account of user) {
    try {
      const { paymentCredential, stakeCredential } = await lucid.getAddressDetails(account.address);
      if (paymentCredential?.type === "Script" || stakeCredential?.type === "Script") {
        for (const { currency, amount } of account.total) {
          const nonLP = !(currency.endsWith(" LP") || (currency.startsWith("asset") && currency.length === 44));
          if (nonLP || amount < 0) continue; // skip NonLP Tokens or negative amounts
          scriptTotal[currency] = (scriptTotal[currency] ?? 0) + amount;
          lpTokens.add(currency);
        }
      } else {
        for (const { currency, amount } of account.total) {
          const nonLP = !(currency.endsWith(" LP") || (currency.startsWith("asset") && currency.length === 44));
          if (nonLP || amount > 0) continue; // skip NonLP Tokens or positive amounts
          nonScriptTotal[currency] = (nonScriptTotal[currency] ?? 0) + amount;
          lpTokens.add(currency);
        }
      }
    } catch {
      continue;
    }
  }

  if (!lpTokens.size) return [0, undefined];
  return [weighting.userAccounts, [...lpTokens.keys()][0].replaceAll("/", "-")];
}

/**
 * There could be metadata with msg:"Minswap: Withdraw Order"
 * @param metadata Transaction Metadata
 * @returns [Score, AdditionalData]
 */
async function calcW2(metadata: Record<string, any>[]): Promise<CalculatedScore<undefined>> {
  return [util.weighMetadataMsg("674", "Minswap Withdraw Order".split(" "), metadata) * weighting.metadata, undefined];
}
