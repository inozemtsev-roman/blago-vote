import { setConnectDebug } from "connectDebug";

const EMBEDDED_DAPP_BRIDGE_CHANNEL = "embedded-dapp-bridge";
const BRIDGE_KEY = "mytonwallet";
const BRIDGE_METHODS = ["connect", "restoreConnection", "disconnect", "send"] as const;

interface RequestState {
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}

type InMessageData =
  | {
      channel?: string;
      messageId: string;
      type: "methodResponse";
      response?: unknown;
      error?: { message: string };
    }
  | {
      channel?: string;
      messageId?: string;
      type: "update";
      update: string;
    };

/**
 * Устанавливает TonConnect js-мост в `window.mytonwallet`, когда приложение
 * запущено как frame внутри кошелька (того же MyTonWallet-протокола).
 *
 * Кошелёк-обёртка слушает канал `embedded-dapp-bridge` (`useIFrameBridgeProvider`)
 * и отвечает на `callMethod`-запросы `tonConnect:*`. Без этого моста приложению
 * остаётся только открывать universal-ссылку кошелька (в Telegram — новое окно
 * мини-аппа), вместо того чтобы подтвердить подключение в самом кошельке.
 *
 * Протокол повторяет `initIframeBridgeConnector` из кошелька (multisend внутри
 * кошелька использует ровно этот механизм).
 */
export function setupEmbeddedWalletBridgeIfNeeded() {
  if (typeof window === "undefined") return;
  if (window.parent === window) return;
  if ((window as any)[BRIDGE_KEY]) return;

  const requestStates = new Map<string, RequestState>();
  const updateHandlers = new Set<(update: string) => void>();

  window.addEventListener("message", (event) => {
    const message = event.data as InMessageData;
    if (!message || message.channel !== EMBEDDED_DAPP_BRIDGE_CHANNEL) return;

    if (message.type === "methodResponse") {
      const requestState = requestStates.get(message.messageId);
      if (!requestState) return;
      requestStates.delete(message.messageId);
      if (message.error) {
        requestState.reject(new Error(message.error.message));
      } else {
        requestState.resolve(message.response);
      }
      return;
    }

    if (message.type === "update") {
      updateHandlers.forEach((handler) => handler(message.update));
    }
  });

  const callApi = (name: string, ...args: any[]) => {
    const messageId =
      Date.now().toString(36) + Math.random().toString(36).slice(2);
    const promise = new Promise<any>((resolve, reject) => {
      requestStates.set(messageId, { resolve, reject });
      promise.finally(() => {
        requestStates.delete(messageId);
      });
    });
    window.parent.postMessage(
      {
        channel: EMBEDDED_DAPP_BRIDGE_CHANNEL,
        messageId,
        type: "callMethod",
        name,
        args,
      },
      "*"
    );
    return promise;
  };

  const methods = Object.fromEntries(
    BRIDGE_METHODS.map((name) => [
      name,
      (...args: any[]) => callApi(`tonConnect:${name}`, ...args),
    ])
  );

  (window as any)[BRIDGE_KEY] = {
    tonconnect: {
      protocolVersion: 2,
      deviceInfo: {
        platform: "other",
        appName: "Gradosphera Wallet",
        appVersion: "1.0.0",
        maxProtocolVersion: 2,
        features: [],
        maxMessageBytes: 1024,
      },
      isWalletBrowser: true,
      ...methods,
      listen: (callback: (update: string) => void) => {
        updateHandlers.add(callback);
        return () => {
          updateHandlers.delete(callback);
        };
      },
    },
  };

  setConnectDebug({ bridgeInstalled: true, inIframe: true });
}