import { beforeEach, describe, expect, it, vi } from "vitest";
import { bf, lucid, util } from "../../src/util/_";
import { Amounts, ScDesc } from "../../src/types/_";
import { Account, Asset } from "../../src/types/manifest";
import { AddressDetails } from "@lucid-evolution/lucid";
import { AssetInfo } from "../../src/util/blockfrost";

describe.concurrent("util", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
  });

  it("isKeyAddress", async () => {
    //#region Arrange
    const address1 = "addr1Key";
    const address2 = "addr2Script";
    //#endregion

    //#region Act
    vi.spyOn(lucid, "getAddressDetails").mockImplementation(
      async (address: string): Promise<AddressDetails> => {
        // console.log({ address });
        return {
          address: {
            bech32: address,
            hex: address,
          },
          networkId: 1,
          type: "Base",
          paymentCredential: {
            hash: address.endsWith("Key") ? "Key" : "Script",
            type: address.endsWith("Key") ? "Key" : "Script",
          },
        };
      });
    const a = await util.isKeyAddress(address1);
    const b = await util.isKeyAddress(address2);
    // console.log({ a, b });
    //#endregion

    //#region Assert
    expect(a).to.be.true;
    expect(b).to.be.false;
    //#endregion
  });

  it("isLovelaceOrADA", async () => {
    //#region Arrange
    const lovelace = "lovelace";
    const ada = "ADA";
    const other = "OTHER Token";
    //#endregion

    //#region Act
    const a = util.isLovelaceOrADA(lovelace);
    const b = util.isLovelaceOrADA(ada);
    const c = util.isLovelaceOrADA(other);
    // console.log({ a, b, c });
    //#endregion

    //#region Assert
    expect(a).to.be.true;
    expect(b).to.be.true;
    expect(c).to.be.false;
    //#endregion
  });

  it("convertAmountToNumber", async () => {
    //#region Arrange
    const amounts = [
      {
        amount: -123456n,
        decimals: 6,
      },
      {
        amount: 123456n,
        decimals: 6,
      },
      {
        amount: 1234567890n,
        decimals: 6,
      },
    ];
    //#endregion

    //#region Act
    const negative0 = util.convertAmountToNumber(
      amounts[0].amount,
      amounts[0].decimals,
    );
    const positive0 = util.convertAmountToNumber(
      amounts[1].amount,
      amounts[1].decimals,
    );
    const nonZero = util.convertAmountToNumber(
      amounts[2].amount,
      amounts[2].decimals,
    );
    //#endregion

    //#region Assert
    expect(negative0).toBe(-.123456);
    expect(positive0).toBe(.123456);
    expect(nonZero).toBe(1234.56789);
    //#endregion
  });

  it("getTotalAmounts", async () => {
    //#region Arrange
    const amounts: Amounts = {
      ADA: 2_000000n,
      NFT: -1n,
      Token: 1234_567890567890n,
      fingerprint: -131n,
      NoFingerprint: 1310n,
      ERROR: 30n,
    };
    //#endregion

    //#region Act
    vi.spyOn(bf, "getAssetInfo").mockImplementation(
      async (unit: string): Promise<AssetInfo> => {
        // console.log({ unit });
        return {
          asset: unit,
          policy_id: unit.slice(0, Math.min(56, unit.length)),
          asset_name: null,
          fingerprint: unit === "NoFingerprint" ? null : `asset1${unit}`,
          quantity: unit === "NFT" ? "1" : "10000000000000000",
          initial_mint_tx_hash: `${unit}_mint_tx_hash`,
          mint_or_burn_count: 0,
          onchain_metadata: unit === "NFT" ? {
            name: unit.length > 56 ? unit.slice(57) : unit,
          } : undefined,
          onchain_metadata_standard: null,
          onchain_metadata_extra: null,
          metadata: unit === "Token" ? {
            name: unit.length > 56 ? unit.slice(57) : unit,
            ticker: null,
            url: null,
            logo: null,
            decimals: 12,
          } : undefined,
          error: unit === "ERROR" ? "Bad Request" : undefined,
        };
      },
    );
    const totalAmounts = await util.getTotalAmounts(amounts);
    // console.log({ totalAmounts });
    //#endregion

    //#region Assert
    const twoADA: Asset = {
      currency: "ADA",
      amount: 2,
    };
    expect(totalAmounts[0]).toMatchObject(twoADA);

    const oneNFT: Asset = {
      currency: "NFT",
      amount: -1,
    };
    expect(totalAmounts[1]).toMatchObject(oneNFT);

    const thousandTokens: Asset = {
      currency: "Token",
      amount: 1234.567890567890,
    };
    expect(totalAmounts[2]).toMatchObject(thousandTokens);

    const hundredFingerprints: Asset = {
      currency: "asset1fingerprint",
      amount: -131,
    };
    expect(totalAmounts[3]).toMatchObject(hundredFingerprints);

    const noFingerprint: Asset = {
      currency: "NoFingerprint",
      amount: 1310,
    };
    expect(totalAmounts[4]).toMatchObject(noFingerprint);

    const errorToken: Asset = {
      currency: "ERROR",
      amount: 30,
    };
    expect(totalAmounts[5]).toMatchObject(errorToken);
    //#endregion
  });

  it("convertAddressAmountsToAccounts", async () => {
    //#region Arrange
    const userAmounts: Record<string, Amounts> = {
      "addr1Key": {
        ADA: 2_000000n,
      },
    };
    const otherAmounts: Record<string, Amounts> = {
      "addr1sundae_swap": {
        ADA: -2_000000n,
      },
      "addr1Script": {
        ADA: 5_000000n,
      },
      "addr1Key": {
        ADA: -5_000000n,
      },
    };
    const lookup: Record<string, ScDesc> = {
      "addr1sundae_swap": {
        category: "amm_dex",
        description: "Yield Farming on SundaeSwap",
        name: "Yield Farming",
        projectName: "SundaeSwap",
        role: "SundaeSwap Yield Farming",
      },
    };
    //#endregion

    //#region Act
    const userAccounts = await util.convertAddressAmountsToAccounts(
      userAmounts,
      "User Address",
      lookup,
    );
    const otherAccounts = await util.convertAddressAmountsToAccounts(
      otherAmounts,
      undefined,
      lookup,
    );
    //#endregion

    //#region Assert
    const userAccount: Account = {
      address: "addr1Key",
      role: "User Address",
      total: [
        {
          currency: "ADA",
          amount: 2,
        },
      ],
    };
    expect(userAccounts[0]).toMatchObject(userAccount);

    const sundaeswapAccount: Account = {
      address: "addr1sundae_swap",
      role: "SundaeSwap Yield Farming",
      total: [
        {
          currency: "ADA",
          amount: -2,
        },
      ],
    };
    expect(otherAccounts[0]).toMatchObject(sundaeswapAccount);

    const unknownScript: Account = {
      address: "addr1Script",
      role: "Unknown Script",
      total: [
        {
          currency: "ADA",
          amount: 5,
        },
      ],
    };
    expect(otherAccounts[1]).toMatchObject(unknownScript);

    const unknownAddress: Account = {
      address: "addr1Key",
      role: "Unknown Address",
      total: [
        {
          currency: "ADA",
          amount: -5,
        },
      ],
    };
    expect(otherAccounts[2]).toMatchObject(unknownAddress);
    //#endregion
  });

  it("joinWords", async () => {
    //#region Arrange
    const words = "Pen Pineapple Apple-Pen".split(" ");
    //#endregion

    //#region Act
    const sentence = util.joinWords(words);
    const word = util.joinWords(["WORD"]);
    //#endregion

    //#region Assert
    expect(sentence).toBe("Pen, Pineapple and Apple-Pen");
    expect(word).toBe("WORD");
    //#endregion
  });

  it("formatAmount", async () => {
    //#region Act
    const ft = util.formatAmount(
      -1234.567890567890,
      "Token",
    );
    const nft = util.formatAmount(
      1,
      "NFT",
    );
    // console.log({ formattedAmount });
    //#endregion

    //#region Assert
    expect(ft).toBe("-1,234.567891 Tokens");
    expect(nft).toBe("1 NFT");
    //#endregion
  });

  it("weighMetadataMsg", async () => {
    //#region Arrange
    const label = "674";
    const keywords = "The quick brown fox".split(" ");
    const metadata = [
      {
        label,
        json_metadata: {
          msg: [
            "All work and no play makes Jack a dull boy",
            "The quick brown fox jumps over the lazy dog",
          ],
        },
      },
    ];
    //#endregion

    //#region Act
    const hit = util.weighMetadataMsg(label, keywords, metadata);
    const miss = util.weighMetadataMsg(label, keywords, []);
    //#endregion

    //#region Assert
    expect(hit).toBe(1);
    expect(miss).toBe(0);
    //#endregion
  });
});
