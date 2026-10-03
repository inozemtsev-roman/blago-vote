import { addBridgeLog, setConnectDebug } from "connectDebug";

const EMBEDDED_DAPP_BRIDGE_CHANNEL = "embedded-dapp-bridge";
const BRIDGE_KEY = "mytonwallet";
const BRIDGE_METHODS = ["connect", "restoreConnection", "disconnect", "send"] as const;

interface RequestState {
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}

let lastConnectResponse: unknown = null;

/**
 * Последний connect-ответ моста (ConnectEvent `{event:'connect', payload}`).
 * Используется как fallback: если SDK не смог обработать connect OK (TDZ в
 * бандле), но кошелёк подтвердил адрес — мы можем материализовать wallet
 * сами и поднять кнопку/голосование без обычного подключения.
 */
export function getLastEmbeddedConnectResponse(): unknown {
  return lastConnectResponse;
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
      update: unknown;
    };

function summarizeResponse(response: unknown): string {
  if (response && typeof response === "object") {
    const r = response as Record<string, unknown>;
    const event = r.event as string | undefined;
    if (event === "connect") {
      const payload = (r.payload ?? {}) as Record<string, unknown>;
      const items = Array.isArray(payload.items)
        ? (payload.items as Record<string, unknown>[]).map((it) => it.name)
        : [];
      return `connect OK items=[${items.join(",")}]`;
    }
    if (event === "connect_error") {
      const payload = (r.payload ?? {}) as Record<string, unknown>;
      return `connect_error code=${payload.code} msg=${String(payload.message).slice(0, 120)}`;
    }
  }
  const s = JSON.stringify(response);
  return s ? s.slice(0, 200) : String(response);
}

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
  const requestNames = new Map<string, string>();
  const updateHandlers = new Set<(update: unknown) => void>();

  window.addEventListener("message", (event) => {
    const message = event.data as InMessageData;
    if (!message || message.channel !== EMBEDDED_DAPP_BRIDGE_CHANNEL) return;

    if (message.type === "methodResponse") {
      const name = requestNames.get(message.messageId) || "?";
      addBridgeLog({
        dir: "in",
        type: "methodResponse",
        name,
        messageId: message.messageId,
        summary: message.error
          ? `ERROR ${message.error.message.slice(0, 160)}`
          : summarizeResponse(message.response),
      });

      const requestState = requestStates.get(message.messageId);
      if (!requestState) return;
      requestStates.delete(message.messageId);
      requestNames.delete(message.messageId);
      if (name === "tonConnect:connect") {
        lastConnectResponse = message.error ? null : (message.response ?? null);
      }
      if (message.error) {
        requestState.reject(new Error(message.error.message));
      } else {
        requestState.resolve(message.response);
      }
      return;
    }

    if (message.type === "update") {
      addBridgeLog({
        dir: "in",
        type: "update",
        summary: JSON.stringify(message.update).slice(0, 200),
      });
      updateHandlers.forEach((handler) => handler(message.update));
    }
  });

  const callApi = (name: string, ...args: any[]) => {
    const messageId =
      Date.now().toString(36) + Math.random().toString(36).slice(2);
    const promise = new Promise<any>((resolve, reject) => {
      requestStates.set(messageId, { resolve, reject });
      requestNames.set(messageId, name);
      promise.finally(() => {
        requestStates.delete(messageId);
        requestNames.delete(messageId);
      });
    });
    addBridgeLog({
      dir: "out",
      type: "callMethod",
      name,
      messageId,
      summary: JSON.stringify(args).slice(0, 200),
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
      listen: (callback: (update: unknown) => void) => {
        updateHandlers.add(callback);
        return () => {
          updateHandlers.delete(callback);
        };
      },
    },
  };

  setConnectDebug({ bridgeInstalled: true, inIframe: true });
}