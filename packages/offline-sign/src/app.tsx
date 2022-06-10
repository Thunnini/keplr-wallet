import React, { FunctionComponent, useMemo } from "react";
import { observer } from "mobx-react-lite";
import { useStore } from "./stores";
import { Coin, DecUtils, Int } from "@keplr-wallet/unit";
import { serializeSignDoc, StdSignDoc } from "@cosmjs/launchpad";
import { Buffer } from "buffer/";
import { PubKeySecp256k1 } from "@keplr-wallet/crypto";
import { BaseAccount, Bech32Address } from "@keplr-wallet/cosmos";
import { TxRaw } from "@keplr-wallet/proto-types/cosmos/tx/v1beta1/tx";
import Axios from "axios";

export const Admins = ["osmo1vv6hruquzpty4xpks9znkw8gys5x4nsng4kery"];

export const TargetAddress = "osmo1vv6hruquzpty4xpks9znkw8gys5x4nsng4kery";
export const TargetMemo = "";
export const AddressToAssets: {
  [address: string]:
    | {
        assets: Coin[];
      }
    | undefined;
} = {
  osmo1vv6hruquzpty4xpks9znkw8gys5x4nsng4kery: {
    assets: [
      {
        denom: "uosmo",
        amount: new Int(10000),
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
                            }

                            const txHash = r?.data?.tx_response?.txhash;
                            if (txHash) {
                              console.log(`Tx hash: ${txHash}`);
                            } else {
                              console.log("Tx maybe failed");
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
