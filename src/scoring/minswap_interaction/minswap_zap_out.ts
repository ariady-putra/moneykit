// type: PASSTHROUGH | amm_dex
// description: Zapped-out {#.## TokenA | and #.## TokenB} for {#.## TokenC | #.## and TokenD} on Minswap

import { Account, Asset, Transaction } from "../../types/manifest";
import { AddressDetails } from "@lucid-evolution/lucid";
import { AddressInfo, TransactionInfo, TransactionUTXOs } from "../../util/blockfrost";
import { bf, lucid, util } from "../../util/_";
import { CalculatedScore, TransactionScore } from "../../types/_";

// user script address with negative asset1...44 and non-script address with positive amounts
// other account of NonKeyAddress with positive asset1...44
// no withdrawal
// metadata { label:"674", json_metadata:{ msg:"Minswap: Order Executed" } }
const weighting = {
  userAccounts: .40,
  otherAccounts: .30,
  withdrawal: .20,
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
    calcW3(intermediaryTx.withdrawal_amount),
    calcW4(intermediaryTx.metadata),
  ]);

  const [, receiveTokens] = weights[0];
  const [, otherTokens] = weights[1];

  try {
    const [lpToken, receivedTokens] = receiveTokens;

    const qty = parseFloat(lpToken.split("-")[1]);
    const fromToken = util.formatAmount(qty, `${otherTokens[lpToken]} LP Token`);

    const toTokens = Object.keys(receivedTokens)
      .map(
        (currency) => {
          let qty = receivedTokens[currency];
          if (currency === "ADA") qty -= 2; // adjustment based on what's displayed on Minswap's dashboard
          // let formattedQty = `${qty}`;
          // if (formattedQty.includes(".")) {
          //   const [a, b] = formattedQty.split(".");
          //   if (b.length > 6) formattedQty = `${a}.${b.slice(0, 6)}`;
          // }
          // return `${formattedQty} ${currency}${currency.toLowerCase().endsWith("token") && qty > 2 ? "s" : ""}`;
          return util.formatAmount(qty, currency);
        }
      );

    const description = `Zapped-out ${fromToken} for ${util.joinWords(toTokens)} on Minswap`;
    const type = intermediaryTx.type === `${undefined}` ? "amm_dex" : intermediaryTx.type;

    const score = weights.reduce(
      (sum, [weight]) => sum + weight,
      0,
    );

    return { type, description, score };
  } catch {
    return {
      type: intermediaryTx.type,
      description: intermediaryTx.description,
      score: 0,
    };
  }
}

/**
 * There must be a user script address with negative asset1...44 amounts,
 * and a non-script address with positive amounts.
 * 
 * @param user User Accounts
 * @returns [Score, AdditionalData]
 */
async function calcW1(user: Account[]): Promise<CalculatedScore<[string, Record<string, number>]>> {
  let lpToken = "";
  let receiveTokens: Record<string, number> = {};
  for (const { address, total } of user) {
    const { paymentCredential, stakeCredential } = await lucid.getAddressDetails(address);
    if (paymentCredential?.type === "Script" || stakeCredential?.type === "Script") {
      for (const { currency, amount } of total) {
        if (currency.startsWith("asset") && currency.length === 44 && amount < 0) {
          lpToken = `${currency}${amount}`;
        }
      }
    } else {
      for (const { currency, amount } of total) {
        receiveTokens[currency] = (receiveTokens[currency] ?? 0) + amount;
      }
    }
  }
  return [lpToken ? weighting.userAccounts : 0, [lpToken, receiveTokens]];
}

/**
 * Collect LP Names from NonKeyAddresses with positive asset1...44 amount.
 * @param other Other Accounts
 * @param txUTXOs Blockfrost TxUTXOs
 * @returns 
 */
async function calcW2(
  other: Account[],
  txUTXOs: TransactionUTXOs,
): Promise<CalculatedScore<Record<string, string>>> {
  const lpNames: Record<string, string> = {};
  for (const { address, role, total } of other) {
    try {
      if (role === "Unknown Address") continue; // skip non-script address
      for (const { currency, amount } of total) {
        try {
          const nonLP = !(currency.startsWith("asset") && currency.length === 44);
          if (nonLP || amount < 0) continue; // skip non-LP or negative amount
          for (const output of txUTXOs.outputs) {
            try {
              if (output.address !== address || !output.data_hash) continue; // skip
              const { json_value } = await bf.getDatum(output.data_hash);
              lpNames[`${currency}-${amount}`] = await lucid.toText(json_value?.fields[2].fields[1].bytes);
            } catch {
              continue;
            }
          }
        } catch {
          continue;
        }
      }
    } catch {
      continue;
    }
  }
  return [Object.keys(lpNames).length ? weighting.otherAccounts : 0, lpNames];
}

/**
 * The user will never withdraw as a the transaction is executed by some batchers.
 * @param withdrawal Whether is there some withdrawals associated with the user address
 * @returns [Score, AdditionalData]
 */
async function calcW3(withdrawal?: Asset): Promise<CalculatedScore<undefined>> {
  return [withdrawal ? 0 : weighting.withdrawal, undefined];
}

/**
 * There should be metadata with msg:"Minswap: Order Executed"
 * @param metadata Transaction Metadata
 * @returns [Score, AdditionalData]
 */
async function calcW4(metadata: Record<string, any>[]): Promise<CalculatedScore<undefined>> {
  return [util.weighMetadataMsg("674", "Minswap Order Executed".split(" "), metadata) * weighting.metadata, undefined];
}
