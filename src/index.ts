require("dotenv").config();

import { env } from "process";
import { logger } from "./util/_";
import express, { Request, Response } from "express";
import rateLimit from "express-rate-limit";

import * as openapi from "express-openapi";
import * as yaml from "js-yaml";
import * as file from "fs";

import * as api from "./handler";

const app = express();
app.use(express.json());

const port = env.HOSTED ? parseInt(`${env.PORT}`) : 35183;
const server = app.listen(port,
  () =>
    // console.log(env.HOSTED ? server.address() : `http://localhost:${port}`),
    logger.log.info(env.HOSTED ? server.address() : `http://localhost:${port}`),
);

const notFound =
  (req: Request, rsp: Response) => {
    rsp.status(404);
    rsp.json({ error: `Cannot ${req.method} ${req.path}` });
  };

const dailyLimit = rateLimit({
  limit: 50_000,
  windowMs: 86_400_000,
  keyGenerator: () => "globalDailyLimit",
  handler: (_, rsp) => rsp.status(429).json({ error: "Daily limit reached!" }),
});
const burstLimit = rateLimit({
  limit: 10,
  windowMs: 1_000,
  keyGenerator: () => "globalBurstLimit",
  handler: (_, rsp) => rsp.status(429).json({ error: "Burst limit reached!" }),
});

const openApiErrRspObj = {
  400: {
    description: "Bad request",
    content: {
      "application/json": {
        schema: {
          $ref: "#/components/schemas/Error",
        },
      },
    },
  },
  429: {
    description: "Usage limit reached",
    content: {
      "application/json": {
        schema: {
          $ref: "#/components/schemas/Error",
        },
      },
    },
  },
  500: {
    description: "Internal Server Error",
    content: {
      "application/json": {
        schema: {
          $ref: "#/components/schemas/Error",
        },
      },
    },
  },
};

//////////////////////////////////////////////////////////////// API Endpoints ////////////////////////////////////////////////////////////////

const expressOpenAPI: openapi.ExpressOpenAPIArgs = {
  app,
  apiDoc: {
    info: {
      title: "Transaction Describer",
      version: "0.0.0",
      license: {
        name: "MIT",
        url: "../LICENSE",
      },
    },
    openapi: "3.0.4",
    servers: [
      {
        description: "Development Server",
        url: "http://127.0.0.1:35183",
      },
    ],
    paths: {

      "/api/v0/addresses/{address}": {
        parameters: [
          {
            in: "path",
            name: "address",
            description: "Bech32 Cardano address",
            schema: {
              type: "string",
            },
            required: true,
          },
          {
            in: "query",
            name: "count",
            description: "The number of transactions",
            schema: {
              type: "integer",
              minimum: 1,
              maximum: 10,
              default: 5,
            },
            required: false,
          },
        ],
        get: {
          summary: "Describe Address Transactions",
          description: "Get the descriptions of the last number of transactions of an address.",
          responses: {
            ...openApiErrRspObj,
            200: {
              description: "Return the manifest for the last number of transactions of the requested address",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Manifest",
                  },
                },
              },
            },
          },
          operationId: "v0_addresses",
        },
      },

      "/api/v0/addresses/{address}/txs/{hash}": {
        parameters: [
          {
            in: "path",
            name: "address",
            description: "Bech32 Cardano Address",
            schema: {
              type: "string",
            },
            required: true,
          },
          {
            in: "path",
            name: "hash",
            description: "Cardano Transaction Hash",
            schema: {
              type: "string",
            },
            required: true,
          },
        ],
        get: {
          summary: "Describe Specific Address Transaction",
          description: "Get the manifest for a specific transaction of an address.",
          responses: {
            ...openApiErrRspObj,
            200: {
              description: "Return the manifest for the requested transaction from the point of view of the requested address",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Manifest",
                  },
                },
              },
            },
          },
          operationId: "v0_addresses_txs",
        },
      },

      "/api/v0/stats": {
        get: {
          summary: "Statistics",
          description: "Get the statistics of the service, such as how many transaction categories and dApps there are.",
          responses: {
            ...openApiErrRspObj,
            200: {
              description: "Return the statistics of the service",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Stats",
                  },
                },
              },
            },
          },
          operationId: "v0_stats",
        },
      },

    },
    components: {
      schemas: {

        Stats: {
          title: "Service Statistics",
          description: "The statistics of the service, such as how many transaction categories and dApps there are.",
          type: "object",
          properties: {
            category: {
              title: "Transaction Category",
              description: "Transaction categories supported by the service.",
              type: "object",
              nullable: false,
              properties: {
                names: {
                  title: "Category Names",
                  description: "Transaction category names.",
                  type: "array",
                  nullable: false,
                  items: {
                    type: "string",
                    uniqueItems: true,
                  },
                },
                count: {
                  title: "Category Count",
                  description: "Transaction category count.",
                  type: "integer",
                  nullable: false,
                },
              },
              required: [
                "names",
                "count",
              ],
            },
            merchant: {
              title: "dApp Projects",
              description: "Supported dApp projects recognized by the service.",
              type: "object",
              nullable: false,
              properties: {
                names: {
                  title: "Project Names",
                  description: "dApp project names.",
                  type: "array",
                  nullable: false,
                  items: {
                    type: "string",
                    uniqueItems: true,
                  },
                },
                count: {
                  title: "Project Count",
                  description: "dApp project count.",
                  type: "integer",
                  nullable: false,
                },
              },
              required: [
                "names",
                "count",
              ],
            },
          },
          required: [
            "category",
            "merchant",
          ],
          example: {
            "category": {
              "names": [
                "amm_dex",
                "blockchain",
                "catalyst_deregistration",
                "catalyst_registration",
                "charity",
                "community",
                "concentrated_liquidity_dex",
                "defi",
                "dex_aggregator",
                "gaming",
                "hybrid_dex",
                "launchpad",
                "layer_2",
                "lending_borrowing",
                "marketplace",
                "mining",
                "mobile_network",
                "multi_stake_delegation",
                "nft",
                "option",
                "oracle",
                "orderbook_dex",
                "other_dex",
                "receive_ada",
                "receive_tokens",
                "send_ada",
                "send_tokens",
                "setup_collateral",
                "stablecoin",
                "stake_delegation",
                "stake_registration",
                "staking",
                "stealth_wallet",
                "synthetics",
                "token_distribution",
                "token_minting",
                "unknown_activity",
                "wrapped_assets",
                "yield_farming"
              ],
              "count": 39
            },
            "merchant": {
              "names": [
                "$USDM",
                "ADA Blobs",
                "ADA Handle",
                "ADA Inmates",
                "adadomains",
                "ADAO",
                "ADAX PRO",
                "anetaBTC",
                "Artano.",
                "Artifct",
                "Astarter",
                "Astor Pool Tokens",
                "Axo",
                "Book.io",
                "Cardahub",
                "Cardania",
                "Cardano Art",
                "Cardano in Color",
                "Cardano Name Service",
                "Cardano Waifus",
                "Cerra",
                "Charli3",
                "CherryLend",
                "Chilled Kongs",
                "Cicada NFT",
                "Clay Nation",
                "Coinecta",
                "CryptoDino",
                "Cryptrolls",
                "CSWAP DEX",
                "CypherMonks",
                "Danogo Bond",
                "DEADPXLZ",
                "Derp Birds",
                "DexHunter",
                "Disco Solaris",
                "Djed StableCoin",
                "DripDropz",
                "Dropspot",
                "ENCOINS",
                "Epoch Art",
                "Explosif",
                "Fabul.art",
                "Filthy Rich Horses",
                "flipr.io",
                "Fluid Tokens",
                "Fortuna",
                "Genesis House",
                "Genius Yield",
                "GOAT Tribe",
                "H.Y.P.E. CNFT",
                "Horrocubes",
                "Hydra",
                "Iagon",
                "Indigo Protocol",
                "Jam On Bread",
                "jpg.store",
                "Kalyx",
                "Kreate",
                "Lending Pond",
                "Lenfi",
                "Levvy Finance",
                "Liqwid Finance",
                "Lobster Challenge",
                "Mad Dog Car Club",
                "Martify Labs",
                "Mashdapp",
                "Matrix Berry",
                "MELD",
                "Meowswap",
                "Milkomeda C1",
                "Minswap",
                "MuesliSwap",
                "MutantNFTs",
                "NFTJAM",
                "old-tales",
                "Optim Finance",
                "OptionFlow",
                "Orcfax",
                "PIGY Oracle",
                "PixelCat",
                "Plutus.Art",
                "Project NEWM's Marketplace",
                "RagAlley",
                "RatsDAO",
                "SaturnNFT",
                "Seedelf",
                "SingularityNET",
                "SmartClaimz",
                "SpaceBudz",
                "Spectrum Finance",
                "Splash Protocol",
                "Summon Platform",
                "SundaeSwap",
                "TeddySwap",
                "The Ape Society",
                "Token Riot",
                "Tokhun",
                "VyFinance",
                "Wanchain",
                "Wild Tangz",
                "Wingriders",
                "World Mobile Token",
                "World of Pirates",
                "Yummi Universe"
              ],
              "count": 105
            }
          },
        },

        Asset: {
          type: "object",
          properties: {
            currency: {
              type: "string",
              nullable: false,
              example: "ADA",
            },
            amount: {
              type: "number",
              nullable: false,
            },
          },
          required: [
            "currency",
            "amount",
          ],
        },

        Account: {
          type: "object",
          properties: {
            address: {
              title: "Bech32 Cardano Address",
              type: "string",
              nullable: false,
              format: "addr1_...",
              example: "addr1_...",
            },
            role: {
              description: "Role associated with during the particular transaction.",
              type: "string",
              nullable: false,
              format: "User Address | Unknown Address | Unknown Script | etc.",
              example: "User Address | Unknown Address | Unknown Script | etc.",
            },
            total: {
              description: "The aggregate amount of the movement of values during the particular transaction.",
              type: "array",
              nullable: false,
              items: {
                $ref: "#/components/schemas/Asset",
              },
            },
          },
          required: [
            "address",
            "role",
            "total",
          ],
        },

        Manifest: {
          type: "object",
          properties: {
            version: {
              title: "Version Number",
              description: "The manifest format version number.",
              type: "integer",
              nullable: false,
            },
            id: {
              title: "Manifest UUID",
              description: "The manifest UUID.",
              type: "string",
              nullable: false,
              example: "12345678-1234-1234-1234-1234567890ab",
            },
            institution: {
              title: "Institution Info",
              description: "The information about the institution.",
              type: "object",
              nullable: false,
              properties: {
                name: {
                  title: "Institution Name",
                  description: "The name of the institution.",
                  type: "string",
                  nullable: false,
                  example: "Cardano",
                },
                network: {
                  title: "Institution Network",
                  description: "The network of the institution.",
                  type: "string",
                  nullable: false,
                  example: "Mainnet",
                },
              },
              required: [
                "name",
                "network",
              ],
            },
            transactions: {
              title: "Transactions Info",
              description: "The information about the transactions.",
              type: "array",
              nullable: false,
              items: {
                title: "Transaction Info",
                description: "The information about a transaction.",
                type: "object",
                nullable: false,
                properties: {
                  transaction_id: {
                    title: "Transaction Hash",
                    description: "The transaction hash that can be queried on a Cardano blockchain explorer.",
                    type: "string",
                    nullable: false,
                    example: "Tx Hash"
                  },
                  timestamp: {
                    title: "Timestamp",
                    description: "The transaction timestamp in epoch millisecond.",
                    type: "integer",
                    nullable: false,
                  },
                  type: {
                    title: "Transaction Type",
                    description: "The value is one of the transaction categories.",
                    type: "string",
                    nullable: false,
                    example: "undefined",
                  },
                  description: {
                    title: "Transaction Description",
                    description: "The human-readable description of the transaction.",
                    type: "string",
                    nullable: false,
                    example: "undefined",
                  },
                  confidence: {
                    title: "Confidence Score",
                    description: "Transaction type/description confidence score.",
                    type: "integer",
                    nullable: true,
                    minimum: 0,
                    maximum: 100,
                  },
                  accounts: {
                    title: "Transaction Accounts",
                    description: "Accounts associated with the particular transaction.",
                    type: "object",
                    nullable: false,
                    properties: {
                      user: {
                        // title: "User Accounts",
                        // description: "Accounts associated with the request address.",
                        type: "array",
                        nullable: false,
                        items: {
                          $ref: "#/components/schemas/Account",
                        },
                      },
                      other: {
                        // title: "Other Accounts",
                        // description: "Accounts not associated with the request address invovled during the particular transaction.",
                        type: "array",
                        nullable: false,
                        items: {
                          $ref: "#/components/schemas/Account",
                        },
                      },
                    },
                    required: [
                      "user",
                      "other",
                    ],
                  },
                  withdrawal_amount: {
                    // title: "Withdrawal Amount",
                    // description: "The withdrawal amount associated with the request address during the particular transaction.",
                    $ref: "#/components/schemas/Asset",
                  },
                  network_fee: {
                    // title: "Network Fee",
                    // description: "The network fee during the particular transaction.",
                    $ref: "#/components/schemas/Asset",
                  },
                  metadata: {
                    title: "Transaction Metadata",
                    description: "Metadata attached during the particular transaction, if any.",
                    type: "array",
                    nullable: false,
                    items: {
                      type: "object",
                    },
                  },
                },
                required: [
                  "transaction_id",
                  "timestamp",
                  "type",
                  "description",
                  "confidence",
                  "accounts",
                  "network_fee",
                  "metadata",
                ],
              },
            },
          },
          required: [
            "version",
            "id",
            "institution",
            "transactions",
          ],
        },

        Error: {
          type: "object",
          properties: {
            error: {
              title: "Error Message",
              description: "Describes the error reason.",
              type: "string",
              nullable: false,
            },
          },
          required: [
            "error",
          ],
        },

      },
    },
    security: [],
  },
  operations: {
    v0_addresses: [
      burstLimit,
      dailyLimit,
      api.describeAddressTransactions,
    ],
    v0_addresses_txs: [
      burstLimit,
      dailyLimit,
      api.describeSpecificAddressTransaction,
    ],
    v0_stats: [
      api.getDescriberStats,
    ],
  },
};

if (!env.HOSTED) file.writeFile(
  "./openapi.yaml",
  yaml.dump(expressOpenAPI.apiDoc, { indent: 2 }),
  // (error) => error ? console.error(error) : undefined,
  (error) => error ? logger.log.error(error) : undefined,
);

openapi.initialize(expressOpenAPI);

app.all("*", notFound);
