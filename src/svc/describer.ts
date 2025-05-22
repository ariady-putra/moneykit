import * as file from "fs";
import path from "path";
import { Amounts, manifest, ScDesc } from "../types/_";
import { Manifest, Transaction } from "../types/manifest";
import { bf, lucid, util } from "../util/_";
import { scoring } from "../scoring/_";

//#region Initialize Known Dapps
const dappsPath = "./crfa-offchain-data-registry/dApps";
const dapps = file.readdirSync(dappsPath);

const distinctProjects: Set<string> = new Set();
const distinctCategories: Set<string> = new Set([
  "unknown_activity",
  // "self_transaction",
  "catalyst_registration",
  "catalyst_deregistration",
  "receive_ada",
  "send_ada",
  "receive_tokens",
  "send_tokens",
  "token_minting",
  "stake_registration",
  "stake_delegation",
  "multi_stake_delegation",
  "setup_collateral",
  "yield_farming",
]);

const scDesc: Record<string, ScDesc> = {};

for (const dapp of dapps) {
  const dappPath = path.join(dappsPath, dapp);
  const dappFile = file.readFileSync(dappPath).toString();

  const { projectName, category, subCategory, scripts } = JSON.parse(dappFile);

  for (const { name, versions } of scripts) {
    for (const { contractAddress } of versions) {
      const tranType =
        `${!subCategory || subCategory === '-' ? category : subCategory}`
          .replaceAll(" ", "_")
          .toLowerCase();

      scDesc[contractAddress] = {
        name,
        projectName,
        category: tranType === "dex" ? "other_dex" : tranType,
        description: `${name ?? "Unknown activity"} on ${projectName}`,
        role: `${name}`.startsWith(projectName) ? name : `${projectName} ${name ?? "Address"}`,
      };

      distinctProjects.add(scDesc[contractAddress].projectName);
      distinctCategories.add(scDesc[contractAddress].category);
    }
  }
}

const stats = {
  category: {
    names: [...distinctCategories].sort((l, r) => l < r ? -1 : 1),
    count: distinctCategories.size,
  },
  merchant: {
    names: [...distinctProjects].sort((l, r) => l.toLowerCase() < r.toLowerCase() ? -1 : 1),
    count: distinctProjects.size,
  },
};
//#endregion

export async function getStats(): Promise<typeof stats> {
  return stats;
}

export async function describeAddressTransactions(address: string, count: number): Promise<Manifest> {
  const addressTransactions = await bf.getAddressTransactions(address);
  if (addressTransactions.error) throw addressTransactions;

  const addressTransactionsManifest: Transaction[] = [];

  // DO NOT BURST BLOCKFROST BY USING Promise.all
  for (let c = 0; c < count && c < addressTransactions.length; c++) {
    const hash = addressTransactions[c].tx_hash;
    const { transactions } = await describeSpecificAddressTransaction(address, hash);
    if (transactions.length) addressTransactionsManifest.push(transactions[0]);
  }

  return {
    ...manifest.default(),
    transactions: addressTransactionsManifest,
  };
}

export async function describeSpecificAddressTransaction(address: string, hash: string): Promise<Manifest> {
  //#region Blockfrost AddressInfo
  const addressInfo = await bf.getAddressInfo(address);
  if (addressInfo.error) throw addressInfo;
  const stakeAddressBech32 = addressInfo.stake_address;
  //#endregion

  //#region Lucid AddressDetails
  const addressDetails = await lucid.getAddressDetails(address);
  //#endregion

  //#region Tx Info
  const tx = await bf.getTransactionInfo(hash);
  if (tx.error) throw {
    status_code: 400,
    message: "Invalid or malformed transaction hash.",
  };
  const timestamp = tx.block_time * 1_000;
  const networkFee = BigInt(tx.fees);
  //#endregion

  //#region Tx UTXOs
  const addressAmounts: Record<string, Amounts> = {};
  const userAddressAmounts: Record<string, Amounts> = {};
  const otherAddressAmounts: Record<string, Amounts> = {};

  let tranType: string | undefined = undefined;
  let tranDesc: string | undefined = undefined;
  // let actualFee = 0n;
  const probableProjects: Set<string> = new Set();

  const utxos = await bf.getTransactionUTXOs(hash);
  if (utxos.error) throw utxos;
  const { inputs, outputs } = utxos;

  //#region Process UTxO Inputs
  for (const { address, amount, collateral, reference } of inputs) {
    if (collateral || reference) continue;
    if (!addressAmounts[address]) addressAmounts[address] = {};

    for (const { unit, quantity } of amount) {
      const currency = unit === "lovelace" ? "ADA" : unit;
      const amount = BigInt(quantity);
      addressAmounts[address][currency] = (addressAmounts[address][currency] ?? 0n) - amount;

      // if (currency === "ADA") actualFee -= amount;
    }

    if (scDesc[address]) {
      tranType = scDesc[address].category;
      tranDesc = scDesc[address].description;
      probableProjects.add(scDesc[address].projectName);
    }
  }
  //#endregion

  //#region Process UTxO Outputs
  for (const { address, amount, collateral, reference } of outputs) {
    if (collateral || reference) continue;
    if (!addressAmounts[address]) addressAmounts[address] = {};

    for (const { unit, quantity } of amount) {
      const currency = unit === "lovelace" ? "ADA" : unit;
      const amount = BigInt(quantity);
      addressAmounts[address][currency] = (addressAmounts[address][currency] ?? 0n) + amount;

      // if (currency === "ADA") actualFee += amount;
    }

    if (scDesc[address]) {
      tranType = scDesc[address].category;
      tranDesc = scDesc[address].description;
      probableProjects.add(scDesc[address].projectName);
    }
  }
  //#endregion

  //#region Group AddressAmounts by PKH / SKH
  for (const key of Object.keys(addressAmounts)) {
    const { paymentCredential, stakeCredential } = await lucid.getAddressDetails(key);
    if (
      (paymentCredential && paymentCredential.hash === addressDetails.paymentCredential?.hash) ||
      (stakeCredential && stakeCredential.hash === addressDetails.stakeCredential?.hash)
    ) {
      userAddressAmounts[key] = addressAmounts[key];
    } else {
      otherAddressAmounts[key] = addressAmounts[key];
    }
  }
  //#endregion
  //#endregion

  //#region Tx Metadata
  let metadata = await bf.getTransactionMetadata(hash);
  if (metadata.error) metadata = [];

  for (const { json_metadata } of metadata) {
    if (json_metadata?.msg?.length) {
      for (const project of distinctProjects) {
        if (json_metadata.msg[0].toUpperCase().includes(project.toUpperCase())) {
          probableProjects.add(project);
        }
      }
    }
  }
  //#endregion

  //#region Tx Withdrawals
  // const withdrawalAmount = networkFee - actualFee;
  let withdrawalAmount: bigint = 0n;
  const withdrawals = await bf.getTransactionWithdrawals(hash);
  if (withdrawals && !withdrawals.error && withdrawals.length) {
    withdrawalAmount = withdrawals.reduce(
      (sum: bigint, withdrawal: { address: string; amount: string; }) =>
        sum += withdrawal.address === stakeAddressBech32 ? BigInt(withdrawal.amount) : 0n,
      0n,
    );
  }
  //#endregion

  //#region Intermediary TxObject
  const transaction: Transaction = {
    transaction_id: hash,
    timestamp,
    type: `${tranType}`,
    description: `${tranDesc}`,
    confidence: null,

    accounts: {
      user: await util.convertAddressAmountsToAccounts(userAddressAmounts, "User Address", scDesc),
      other: await util.convertAddressAmountsToAccounts(otherAddressAmounts, undefined, scDesc),
    },

    withdrawal_amount: !withdrawalAmount ? undefined : {
      currency: "ADA",
      amount: util.convertAmountToNumber(withdrawalAmount, 6),
    },

    network_fee: {
      currency: "ADA",
      amount: util.convertAmountToNumber(networkFee, 6),
    },

    metadata,
  };
  //#endregion

  //#region Post-process TxObject
  const highestConfidence = await scoring.calcConfidenceScoreOf(
    transaction,
    [...probableProjects],
    addressInfo,
    addressDetails,
    tx,
    utxos,
  );
  //#endregion

  return {
    ...manifest.default(),
    transactions: [highestConfidence],
  };
}
