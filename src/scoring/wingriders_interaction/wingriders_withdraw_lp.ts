// type: PASSTHROUGH | amm_dex
// description: Withdrew #.## XXX-YYY LP Tokens from Wingriders

import { Account, Asset, Transaction } from "../../types/manifest";
import { AddressDetails } from "@lucid-evolution/lucid";
import { AddressInfo, TransactionInfo, TransactionUTXOs } from "../../util/blockfrost";
import { CalculatedScore, TransactionScore } from "../../types/_";
import { util } from "../../util/_";

// other.role there's a Wingriders Farm... with negative amount(s) LPtokens
// no withdrawal if ran through Wingriders UI
// no metadata if ran through Wingriders UI
const weighting = {
  otherAccounts: .80,
  withdrawal: .10,
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
    calcW1(intermediaryTx.accounts.other),
    calcW2(intermediaryTx.withdrawal_amount),
    calcW3(intermediaryTx.metadata),
  ]);

  const [, lpTokens] = weights[0];

  const description = lpTokens?.length
    ? `Withdrew ${util.joinWords(lpTokens)} LP Tokens from Wingriders`
    : "Withdrew LP Tokens from Wingriders";
  const type = lpTokens?.length ? "amm_dex" : intermediaryTx.type;

  const score = weights.reduce(
    (sum, [weight]) => sum + weight,
    0,
  );

  return { type, description, score };
}

/**
 * There should be a Wingriders Farm... with negative amount(s) LPtokens.
 * @param other Other Accounts
 * @returns [Score, AdditionalData]
 */
async function calcW1(other: Account[]): Promise<CalculatedScore<string[]>> {
  const assets = other.reduce(
    (sum, { total }) => {
      total.reduce(
        (sum, { currency, amount }) => {
          sum[currency] = (sum[currency] ?? 0) - amount;
          return sum;
        },
        sum,
      );
      return sum;
    },
    {} as Record<string, number>,
  );

  const currencies = Object.keys(assets);
  const lpTokens = currencies.filter(
    (currency) =>
      assets[currency] > 0 && currency.startsWith("WR-LPT")
  ).map(
    (currency) =>
      `${assets[currency]} ${currency
        .replace("WR-LPT-", "")
        .replaceAll("/", "-")
      }`
  );

  return [weighting.otherAccounts * other.filter(
    ({ role, total }) =>
      role.startsWith("Wingriders") && total.find(
        ({ currency }) =>
          currency.includes("-LPT-")
      )
  ).length / other.length, lpTokens];
}

/**
 * No withdrawal if ran through Wingriders UI
 * @param withdrawal Whether is there some withdrawals associated with the user address
 * @returns [Score, AdditionalData]
 */
async function calcW2(withdrawal?: Asset): Promise<CalculatedScore<undefined>> {
  return [withdrawal ? 0 : weighting.withdrawal, undefined];
}

/**
 * There should be no metadata if ran through the Wingriders UI
 * @param metadata Transaction Metadata
 * @returns [Score, AdditionalData]
 */
async function calcW3(metadata: Record<string, any>[]): Promise<CalculatedScore<undefined>> {
  return [metadata.length ? 0 : weighting.metadata, undefined];
}
