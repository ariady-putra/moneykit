import { describe, expect, it } from "vitest";
import { util } from "../../src/util/_";

describe.concurrent("util", () => {
  it("weighMetadataMsg", async () => {
    //#region Arrange
    const label = "674";
    const keywords = "The quick brown fox".split(" ");
    const metadata = [
      {
        label,
        json_metadata: {
          msg: ["The quick brown fox jumps over the lazy dog"],
        },
      },
    ];
    //#endregion

    //#region Act
    const weight = util.weighMetadataMsg(label, keywords, metadata);
    // console.log({ weight });
    //#endregion

    //#region Assert
    // assert.equal(weight, 1);
    expect(weight).toBe(1);
    //#endregion
  });
});
