// type: self_transaction
// description: Self Transaction

import { Account, Transaction } from "../../types/manifest";
import { AddressDetails } from "@lucid-evolution/lucid";
import { AddressInfo, TransactionInfo, TransactionUTXOs } from "../../util/blockfrost";
import { CalculatedScore, TransactionScore } from "../../types/_";

// user.total.length
// other.role.length === 0
const weighting = {
  userAccounts: .50,
  otherAccounts: .50,
};
export async function score(
  { accounts }: Transaction,
  bfAddressInfo: AddressInfo,
  lucidAddressDetails: AddressDetails,
  txInfo: TransactionInfo,
  txUTXOs: TransactionUTXOs,
): Promise<TransactionScore> {
  const weights = await Promise.all([
    calcW1(accounts.user),
    calcW2(accounts.other),
  ]);

  const description = "Self Transaction";
  const type = "self_transaction";

  const score = weights.reduce(
    (sum, [weight]) => sum + weight,
    0,
  );

  return { type, description, score };
}

/**
 * Has at least a user account.
 * @param user User Accounts
 * @returns [Score, AdditionalData]
 */
async function calcW1(user: Account[]): Promise<CalculatedScore<undefined>> {
  return [user.length ? weighting.userAccounts : 0, undefined];
}

/**
 * Has no other accounts.
 * @param other Other Accounts
 * @returns [Score, AdditionalData]
 */
async function calcW2(other: Account[]): Promise<CalculatedScore<undefined>> {
  return [other.length ? 0 : weighting.otherAccounts, undefined];
}
