import { TonConnect } from "@tonconnect/sdk";
import { manifestUrl } from "config";

export const tonConnect = new TonConnect({
  manifestUrl,
  walletsListSource: "/wallets-v2.json",
});