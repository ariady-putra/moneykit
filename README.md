# Anastasia Labs X MoneyKit - Transaction Manifests

![image](https://cardano.ideascale.com/a/community-id/163/attachments/embedded-files/5-4227ea-42de33/png)

## FinTech Platform Integration for Cardano

Cardano lacks human-readable transactions and integration in enterprise fintech, limiting its use in traditional financial services and tools. MoneyKit is an innovative and robust platform and SDK that empowers developers to create financial applications for both mobile and web platforms with unparalleled ease and efficiency. This cutting-edge solution offers many advantages that make it an invaluable asset for the financial technology ecosystem, and it is positioned to make a significant positive impact in the field.

## How to Run

Prerequisites:

- NodeJS v22.x
- pnpm v10.x

This project uses [Blockfrost](https://blockfrost.io) as the provider, so you must setup a `.env` file at the root directory (the same level as the `package.json` file) with the following content:

```env
BF_PID=mainnet_YOUR_BLOCKFROST_API_KEY
BF_URL=https://cardano-mainnet.blockfrost.io/api/v0
```

Supported Cardano Network:

- MAINNET

Run `pnpm i && pnpm dev` if this is the first time you're running the project, otherwise you can just run the `pnpm dev` command. The default port used is `35183`; You can override it by setting the `PORT` environment variable.

There are 3 endpoints at the moment:

- GET `/api/v0/stats` to get the statistics of the service, such as how many transaction categories and dApps there are
- GET `/api/v0/addresses/{ADDR}/txs/{HASH}` to get the description of a specific transaction of an address, where `ADDR` is a Bech32 address and `HASH` is a transaction hash
- GET `/api/v0/addresses/{ADDR}?count={NUMB}` to get the descriptions of the last `n` transactions of an address determined by the `count` parameter, where the maximum number of transactions per request is 10; if `count` is not provided then it's default to 5

A [Postman](https://www.postman.com) collection is provided [here](manifest.postman_collection.json).

## Acknowledgement

This project relies on the [Off-chain Data Registry](https://github.com/Cardano-Fans/crfa-offchain-data-registry). Big shout-out to [Cardano-Fans](https://cardano.fans)!
