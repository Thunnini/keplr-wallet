import React, { FunctionComponent, useMemo } from "react";
import { observer } from "mobx-react-lite";
import { useStore } from "./stores";
import { Coin, DecUtils, Int } from "@keplr-wallet/unit";
import { StdSignDoc } from "@cosmjs/launchpad";
import { Buffer } from "buffer/";

export const TargetAddress = "cosmos1vv6hruquzpty4xpks9znkw8gys5x4nsnqw9f4k";
export const TargetMemo = "";
export const AddressToAssets: {
  [address: string]:
    | {
        assets: Coin[];
      }
    | undefined;
} = {
  cosmos1vv6hruquzpty4xpks9znkw8gys5x4nsnqw9f4k: {
    assets: [
      {
        denom: "uatom",
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
                  console.log(Buffer.from(txBytes).toString("base64"));
                  console.log(signDoc);

                  const a = document.createElement("a");
                  const file = new Blob(
                    [
                      JSON.stringify(
                        {
                          txBytes: Buffer.from(txBytes).toString("base64"),
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
    </div>
  );
});
