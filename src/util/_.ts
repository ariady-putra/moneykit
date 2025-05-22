export * as bf from "./blockfrost";
export * as cache from "./cache";
export * as lucid from "./lucid";

import { Amounts, ScDesc } from "../types/_";
import { Account, Asset } from "../types/manifest";
import * as bf from "./blockfrost";
import * as lucid from "./lucid";

export const util = {
  isKeyAddress: async (address: string): Promise<boolean> => {
    const { paymentCredential } = await lucid.getAddressDetails(address);
    return paymentCredential?.type === "Key";
  },

  isLovelaceOrADA: (currency: string): boolean => {
    const c = currency.toLowerCase();
    return c === "lovelace" || c === "ada";
  },

  convertAmountToNumber: (amount: bigint, decimals: number): number => {
    const t = BigInt(10 ** decimals);
    const a = amount / t;
    const b = (amount < 0n ? -amount : amount) % t;
    return parseFloat(`${a ? a : (amount < 0n ? "-0" : "0")}.${`${b}`.padStart(decimals, "0")}`);
  },

  getTotalAmounts: (amounts: Amounts): Promise<Asset[]> =>
    Promise.all(Object.keys(amounts)
      .filter((currency) => amounts[currency] !== 0n)
      .map(
        async (currency): Promise<Asset> => {
          let fromUnit = util.isLovelaceOrADA(currency)
            ? { metadata: { name: currency, decimals: 6 } } as bf.AssetInfo
            : await bf.getAssetInfo(currency);
          if (fromUnit.error) fromUnit = { metadata: { name: currency, decimals: 0 } } as bf.AssetInfo;

          const decimals = fromUnit.metadata?.decimals ?? 0;

          return {
            currency: fromUnit.metadata?.name ?? fromUnit.onchain_metadata?.name ?? fromUnit.fingerprint ?? currency,
            amount: util.convertAmountToNumber(amounts[currency], decimals),
          };
        },
      ),
    ),

  convertAddressAmountsToAccounts: (
    addressAmounts: Record<string, Amounts>,
    addressRole: string | undefined,
    lookup: Record<string, ScDesc>,
  ): Promise<Account[]> =>
    Promise.all(
      Object.keys(addressAmounts).map(
        async (address): Promise<Account> => {
          return {
            address,
            role: addressRole ?? lookup[address]?.role ?? `Unknown ${await util.isKeyAddress(address) ? "Address" : "Script"}`,
            total: await util.getTotalAmounts(addressAmounts[address]),
          };
        },
      ),
    ),

  joinWords: (words: string[]): string => {
    if (words.length < 2) return words.join("");
    if (words.length === 2) return words.join(" and ");

    const last = words.length - 1;
    return util.joinWords([words.slice(0, last).join(", "), words[last]]);
  },

  formatAmount: (amount: number, currency: string) =>
    // TODO: Thousand Separator
    `${amount} ${currency}${Math.abs(amount) > 1 && currency.toLowerCase().endsWith("token") ? "s" : ""}`,

  weighMetadataMsg: (label: string, keywords: string[], metadata: Record<string, any>[]) => {
    if (!metadata.length) return 0;

    const keywordsCount = keywords.length;
    const KEYWORDS = keywords.map(
      (keyword) =>
        keyword.toUpperCase(),
    );

    return metadata.filter(
      (data) =>
        data.label === label && data.json_metadata?.msg?.find(
          (message: string) => {
            let hit = 0;
            let startPos = 0;

            for (const KEYWORD of KEYWORDS) {
              let k = message.toUpperCase().indexOf(KEYWORD, startPos);

              if (k < 0) break;
              startPos = k + 1;
              hit += 1;
            }

            return hit === keywordsCount;
          }
        )
    ).length / metadata.length;
  },
};
