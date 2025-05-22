import { AddressDetails } from "@lucid-evolution/lucid";
import { AddressInfo, TransactionInfo, TransactionUTXOs } from "../util/blockfrost";
import { Transaction } from "./manifest";

export * as manifest from "./manifest";

export type ScDesc = {
  name: string;
  projectName: string;
  category: string;
  description: string;
  role: string;
};

export type Amounts = Record<string, bigint>;

//#region Scoring
export type Score = number;
export type CalculatedScore<AdditionalData> = [Score, AdditionalData];
export type TransactionScore = {
  type: string;
  description: string;
  score: Score;
};

export type ScoringFn = (
  intermediaryTx: Transaction,
  bfAddressInfo: AddressInfo,
  lucidAddressDetails: AddressDetails,
  txInfo: TransactionInfo,
  txUTXOs: TransactionUTXOs,
) => Promise<TransactionScore>;
export type ScoringSvc = {
  scoring: ScoringFn[];
  fallback: ScoringFn;
};
//#endregion
