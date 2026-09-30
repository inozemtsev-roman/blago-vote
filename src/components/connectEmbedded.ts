import type { TonConnectUI } from "@tonconnect/ui";

const GRADOSPHERA_WALLET_APP_NAME = "gradospherawallet";

export async function tryConnectEmbeddedWallet(
  tonConnectUI: TonConnectUI,
): Promise<boolean> {
  try {
    const wallets = await tonConnectUI.getWallets();
    const target = wallets.find(
      (wallet) => wallet.appName === GRADOSPHERA_WALLET_APP_NAME,
    );
    if (!target || !("jsBridgeKey" in target)) return false;

    const hasJsProvider =
      target.injected ||
      target.embedded ||
      !!(window as any)[target.jsBridgeKey]?.tonconnect;
    if (!hasJsProvider) return false;

    await tonConnectUI.connector.connect({ jsBridgeKey: target.jsBridgeKey });
    return true;
  } catch (e) {
    console.warn("Не удалось подключиться через встроенный кошелёк:", e);
    return false;
  }
}