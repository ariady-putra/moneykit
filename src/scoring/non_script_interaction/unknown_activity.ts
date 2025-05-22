// type: unknown_activity
// description: Unknown Activity

import { AddressDetails } from "@lucid-evolution/lucid";
import { AddressInfo, TransactionInfo, TransactionUTXOs } from "../../util/blockfrost";
import { Transaction } from "../../types/manifest";
import { TransactionScore } from "../../types/_";

export async function score(
  {}: Transaction,
  bfAddressInfo: AddressInfo,
  lucidAddressDetails: AddressDetails,
  txInfo: TransactionInfo,
  txUTXOs: TransactionUTXOs,
): Promise<TransactionScore> {
  return {
    type: "unknown_activity",
    description: "Unknown Activity",
    score: 1,
  };
}
