// type: catalyst_registration
// description: Catalyst Registration

import { AddressDetails } from "@lucid-evolution/lucid";
import { AddressInfo, TransactionInfo, TransactionUTXOs } from "../../util/blockfrost";
import { CalculatedScore, TransactionScore } from "../../types/_";
import { Transaction } from "../../types/manifest";

// Catalyst registration metadata
const weighting = {
  metadata: 1.00,
};

export async function score(
  { metadata }: Transaction,
  bfAddressInfo: AddressInfo,
  lucidAddressDetails: AddressDetails,
  txInfo: TransactionInfo,
  txUTXOs: TransactionUTXOs,
): Promise<TransactionScore> {
  const weights = await Promise.all([
    calcW1(metadata),
  ]);

  const description = "Catalyst Registration";
  const type = "catalyst_registration";

  const score = weights.reduce(
    (sum, [weight]) => sum + weight,
    0,
  );

  return { type, description, score };
}

/**
 * label: 61284 (CIP-0015 - Catalyst registration) alongside
 * label: 61285 (CIP-0015 - Catalyst witness)
 * 
 * @param metadata Transaction Metadata
 * @returns [Score, AdditionalData]
 */
async function calcW1(metadata: Record<string, any>[]): Promise<CalculatedScore<undefined>> {
  if (!metadata.length) return [0, undefined];

  return [weighting.metadata * metadata.filter(
    ({ label }) =>
      label === "61284" || label === "61285"
  ).length / metadata.length, undefined];
}
