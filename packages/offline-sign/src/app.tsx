import React, { FunctionComponent, useMemo } from "react";
import { observer } from "mobx-react-lite";
import { useStore } from "./stores";
import { Coin, DecUtils, Int } from "@keplr-wallet/unit";
import { serializeSignDoc, StdSignDoc } from "@cosmjs/launchpad";
import { Buffer } from "buffer/";
import { PubKeySecp256k1 } from "@keplr-wallet/crypto";
import {
  BaseAccount,
  Bech32Address,
  TendermintTxTracer,
} from "@keplr-wallet/cosmos";
import { TxRaw } from "@keplr-wallet/proto-types/cosmos/tx/v1beta1/tx";
import Axios from "axios";

export const Admins = [
  "osmo1vv6hruquzpty4xpks9znkw8gys5x4nsng4kery",
  "osmo1z98eg2ztdp2glyla62629nrlvczg8s7f8sgpm5",
  "osmo12smx2wdlyttvyzvzg54y2vnqwq2qjateuf7thj",
];

export const TargetAddress = "osmo1rdkpu0tfnp3vx7vg4gxhjr0gt9rtydtv4fsrd0";
export const TargetMemo = "";
export const AddressToAssets: {
  [address: string]:
    | {
        assets: Coin[];
      }
    | undefined;
} = {
  osmo18qx59wy8s3ytax3e0akna934e86mw776vlzjtq: {
    assets: [
      {
        denom: "uosmo",
        amount: new Int("118165000000"),
      },
      {
        // ATOM
        denom:
          "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
        amount: new Int("14043017000"),
      },
      {
        // USDC
        denom:
          "ibc/D189335C6E4A68B513C10AB227BF1C1D38C746766278BA3EEB4FB14124F1D858",
        amount: new Int("1025000000"),
      },
      {
        // DAI
        denom:
          "ibc/0CD3A0285E1341859B5E86B6AB7682F023D03E97607CCC1DC95706411D866DF7",
        amount: new Int("1155000000000000000000"),
      },
    ],
  },
  osmo1hq8tlgq0kqz9e56532zghdhz7g8gtjymdltqer: {
    assets: [
      {
        // USDC
        denom:
          "ibc/D189335C6E4A68B513C10AB227BF1C1D38C746766278BA3EEB4FB14124F1D858",
        amount: new Int("732258085055"),
      },
      {
        denom: "gamm/pool/678",
        amount: new Int("35971101923736112255421"),
      },
    ],
  },
  osmo1v44mqmhvtn8cw373xv0hw6npddccnr70lqsk9s: {
    assets: [
      {
        // USDC
        denom:
          "ibc/D189335C6E4A68B513C10AB227BF1C1D38C746766278BA3EEB4FB14124F1D858",
        amount: new Int("86335000000"),
      },
      {
        // CMDX
        denom:
          "ibc/EA3E1640F9B1532AB129A571203A0B9F789A7F14BB66E350DCBFA18E1A1931F0",
        amount: new Int("29044000000"),
      },
    ],
  },
  osmo10t26acjmemggsahq6uvyucm4tj3z0mhz23ljh2: {
    assets: [
      {
        denom: "uosmo",
        amount: new Int("50142713100"),
      },
      {
        // WBTC
        denom:
          "ibc/D1542AA8762DB13087D8364F3EA6509FD6F009A34F00426AF9E4F9FA85CBBF1F",
        // Decimal is 8
        amount: new Int("222460484"),
      },
    ],
  },
  osmo1ux20lcw7et2j8kl8gfdep78lacew4dqqjp5dvp: {
    assets: [
      {
        // WBTC
        denom:
          "ibc/D1542AA8762DB13087D8364F3EA6509FD6F009A34F00426AF9E4F9FA85CBBF1F",
        // Decimal is 8
        amount: new Int("33517000"),
      },
    ],
  },
  osmo1jfxcl8ja3nnfjduqemptknz2j6nk6502zp3rte: {
    assets: [
      {
        denom: "gamm/pool/561",
        amount: new Int("777276479265592611176835"),
      },
    ],
  },
  // Josh's account for testing
  osmo1z98eg2ztdp2glyla62629nrlvczg8s7f8sgpm5: {
    assets: [
      {
        denom: "uosmo",
        amount: new Int("100000"),
      },
      {
        // ATOM
        denom:
          "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
        amount: new Int("100000"),
      },
    ],
  },
  // Tony's account for testing
  osmo1vv6hruquzpty4xpks9znkw8gys5x4nsng4kery: {
    assets: [
      {
        denom: "uosmo",
        amount: new Int("10000"),
      },
      {
        // ATOM
        denom:
          "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
        amount: new Int("1000"),
      },
    ],
  },
};

export const App: FunctionComponent = observer(() => {
  const { chainStore, accountStore } = useStore();

  const chainId = chainStore.chainInfos[0].chainId;
  const account = accountStore.getAccount(chainId);

  const needToSendAssets = useMemo(() => {
    return AddressToAssets[account.bech32Address];
  }, [account.bech32Address]);

  const isAdmin = useMemo(() => {
    return Admins.find((admin) => admin === account.bech32Address) != null;
  }, [account.bech32Address]);

  return (
    <div>
      <p>Name: {account.name}</p>
      <p>Address: {account.bech32Address}</p>

      {needToSendAssets && needToSendAssets.assets.length > 0 ? (
        <button
          onClick={async (e) => {
            e.preventDefault();

            try {
              await account.cosmos.sendTokensMsgTemp(
                needToSendAssets.assets.map((asset) => {
                  const currency = chainStore
                    .getChain(chainId)
                    .forceFindCurrency(asset.denom);

                  return {
                    currency,
                    amount: asset.amount
                      .toDec()
                      .mul(DecUtils.getTenExponentN(-currency.coinDecimals))
                      .toString(),
                  };
                }),
                TargetAddress,
                TargetMemo,
                {
                  gas: "800000",
                  amount: [
                    {
                      denom: chainStore.getChain(chainId).stakeCurrency
                        .coinMinimalDenom,
                      amount: "0",
                    },
                  ],
                },
                {
                  preferNoSetFee: true,
                  preferNoSetMemo: true,
                },
                (txBytes: Uint8Array, signDoc: StdSignDoc) => {
                  const a = document.createElement("a");
                  const file = new Blob(
                    [
                      JSON.stringify(
                        {
                          txBytes: Buffer.from(txBytes).toString("base64"),
                          pubKey: Buffer.from(account.pubKey).toString(
                            "base64"
                          ),
                          signDoc,
                        },
                        null,
                        2
                      ),
                    ],
                    {
                      type: "text/plain",
                    }
                  );
                  a.href = URL.createObjectURL(file);
                  a.download = "offline-tx.json";
                  a.click();
                }
              );
            } catch (e) {
              console.log(e);
              alert(`Failed to sign tx: ${e.message}`);
            }
          }}
        >
          Sign
        </button>
      ) : null}
      {isAdmin ? (
        <div>
          <br />
          <button
            onClick={(e) => {
              e.preventDefault();

              const input = document.createElement("input");

              input.type = "file";
              input.accept = ".json";

              input.onchange = (e) => {
                if (e.target) {
                  const inputElem = e.target as HTMLInputElement;
                  if (inputElem.files && inputElem.files.length > 0) {
                    const file = inputElem.files[0];

                    const reader = new FileReader();
                    reader.onload = () => {
                      if (typeof reader.result === "string") {
                        const tx = JSON.parse(reader.result);

                        const pubKey = new PubKeySecp256k1(
                          Buffer.from(tx.pubKey, "base64")
                        );
                        const rawAddress = pubKey.getAddress();
                        const bech32Address = new Bech32Address(
                          rawAddress
                        ).toBech32(
                          chainStore.getChain(chainId).bech32Config
                            .bech32PrefixAccAddr
                        );

                        console.log(
                          `Address from public key: ${bech32Address}`
                        );

                        const chainInfo = chainStore.getChain(chainId);
                        const axiosInstance = Axios.create({
                          ...{
                            baseURL: chainInfo.rest,
                          },
                          ...chainInfo.restConfig,
                        });

                        BaseAccount.fetchFromRest(
                          axiosInstance,
                          bech32Address,
                          true
                        ).then((account) => {
                          console.log(
                            `Current account's sequence: ${account
                              .getSequence()
                              .toString()}`
                          );

                          const txRaw = TxRaw.decode(
                            Buffer.from(tx.txBytes, "base64")
                          );

                          console.log(
                            `Sequence in sign doc is: ${tx.signDoc.sequence}`
                          );

                          if (
                            account.getSequence().toString() !==
                            tx.signDoc.sequence
                          ) {
                            console.log("Sequence unmatched");
                          }

                          const signature = txRaw.signatures[0];

                          const signDocBytes = serializeSignDoc(tx.signDoc);

                          if (pubKey.verify(signDocBytes, signature)) {
                            console.log("Signature verified");
                          } else {
                            console.log("Invalid signature!!!");
                          }

                          axiosInstance
                            .post("/cosmos/tx/v1beta1/simulate", {
                              tx_bytes: tx.txBytes,
                            })
                            .then((r) => {
                              console.log(r);

                              console.log("List events");
                              for (const event of r.data.result.events) {
                                for (const attr of event.attributes) {
                                  console.log(
                                    `Type: ${event.type}, Key: ${Buffer.from(
                                      attr.key,
                                      "base64"
                                    ).toString()}, Value: ${Buffer.from(
                                      attr.value,
                                      "base64"
                                    ).toString()}`
                                  );
                                }
                              }
                            });
                        });
                      }
                    };

                    reader.readAsText(file);
                  }
                }
              };

              input.click();
            }}
          >
            Simulate
          </button>
          <br />
          <button
            onClick={(e) => {
              e.preventDefault();

              const input = document.createElement("input");

              input.type = "file";
              input.accept = ".json";

              input.onchange = (e) => {
                if (e.target) {
                  const inputElem = e.target as HTMLInputElement;
                  if (inputElem.files && inputElem.files.length > 0) {
                    const file = inputElem.files[0];

                    const reader = new FileReader();
                    reader.onload = () => {
                      if (typeof reader.result === "string") {
                        const tx = JSON.parse(reader.result);

                        const chainInfo = chainStore.getChain(chainId);
                        const axiosInstance = Axios.create({
                          ...{
                            baseURL: chainInfo.rest,
                          },
                          ...chainInfo.restConfig,
                        });

                        axiosInstance
                          .post("/cosmos/tx/v1beta1/txs", {
                            tx_bytes: tx.txBytes,
                            mode: "BROADCAST_MODE_SYNC",
                          })
                          .then((r) => {
                            console.log(r);

                            const code = r?.data?.tx_response?.code;

                            if (code) {
                              console.log(`Tx failed code: ${code}`);
                            } else {
                              const txHash = r?.data?.tx_response?.txhash;
                              if (txHash) {
                                console.log(`Tx hash: ${txHash}`);
                                console.log("Wait tx to be included in block");

                                const txTracer = new TendermintTxTracer(
                                  chainInfo.rpc,
                                  "/websocket"
                                );
                                txTracer
                                  .traceTx(Buffer.from(txHash, "hex"))
                                  .then((tx) => {
                                    if (tx.code == null || tx.code === 0) {
                                      console.log("Tx succeeds");
                                    } else {
                                      console.log(`Tx failed code: ${tx.code}`);
                                    }
                                    console.log(tx);
                                  })
                                  .catch((e) => {
                                    console.log(
                                      `Failed to trace the tx (${txHash})`,
                                      e
                                    );
                                  });
                              } else {
                                console.log("Tx maybe failed");
                              }
                            }
                          });
                      }
                    };

                    reader.readAsText(file);
                  }
                }
              };

              input.click();
            }}
          >
            Broadcast
          </button>
        </div>
      ) : null}
    </div>
  );
});
