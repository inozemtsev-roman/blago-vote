import { TonConnect } from "@tonconnect/sdk";
import { manifestUrl } from "config";

import { setupEmbeddedWalletBridgeIfNeeded } from "tonConnectBridge";

setupEmbeddedWalletBridgeIfNeeded();

export const tonConnect = new TonConnect({
  manifestUrl,
  walletsListSource: "/wallets-v2.json",
});