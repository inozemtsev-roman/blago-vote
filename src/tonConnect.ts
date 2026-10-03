import { TonConnect } from "@tonconnect/sdk";
import { manifestUrl } from "config";

import { setupEmbeddedWalletBridgeIfNeeded } from "tonConnectBridge";
import { createSafeTonConnectStorage } from "safeStorage";

setupEmbeddedWalletBridgeIfNeeded();

export const tonConnect = new TonConnect({
  manifestUrl,
  walletsListSource: "/wallets-v2.json",
  storage: createSafeTonConnectStorage(),
  analytics: { mode: "off" },
});