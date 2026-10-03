import { useEffect, useState } from "react";
import { Box, styled } from "@mui/material";

export type BridgeLogEntry = {
  id: number;
  channel?: string;
  messageId?: string;
  type: string;
  name?: string;
  dir: "in" | "out";
  summary: string;
};

export interface ConnectDebugState {
  inIframe: boolean;
  referrer: string | null;
  bridgeInstalled: boolean;
  gotTarget: boolean;
  hasJsProvider: boolean;
  targetInjected: boolean;
  targetEmbedded: boolean;
  targetAppName?: string;
  hasJsProviderByKey?: boolean;
  connectResult: null | boolean;
  connectError: string;
  connectMs: number;
  connectorHasWallet: boolean;
  uiHasWallet: boolean;
  uiConnected: boolean;
  bridgeHasTonconnect: boolean;
  jsBridgeKeyTarget?: string;
  fallback: string;
  statusHistory: string[];
  bridgeLog: BridgeLogEntry[];
  unhandledRejections: string[];
}

export const connectDebug: ConnectDebugState = {
  inIframe: typeof window !== "undefined" && window.parent !== window,
  referrer: typeof window !== "undefined" ? document.referrer || null : null,
  bridgeInstalled: false,
  gotTarget: false,
  hasJsProvider: false,
  targetInjected: false,
  targetEmbedded: false,
  connectResult: null,
  connectError: "",
  connectMs: 0,
  connectorHasWallet: false,
  uiHasWallet: false,
  uiConnected: false,
  bridgeHasTonconnect: false,
  fallback: "",
  statusHistory: [],
  bridgeLog: [],
  unhandledRejections: [],
};

// Фиксируем тихие сбои обёрнутых колбэков @tonconnect/ui (async onStatusChange):
// если getSelectedWalletInfo бросает внутри, колбэк useTonWallet не вызывается,
// а promise уходит в unhandledrejection.
if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (e) => {
    const reason =
      typeof e.reason === "object" && e.reason && "message" in e.reason
        ? String((e.reason as Error).message)
        : String(e.reason);
    connectDebug.unhandledRejections.push(reason.slice(0, 300));
    if (connectDebug.unhandledRejections.length > 10) {
      connectDebug.unhandledRejections.splice(0, connectDebug.unhandledRejections.length - 10);
    }
    console.warn("[blago unhandledrejection]", e.reason);
  });
}

let nextLogId = 0;

export function addBridgeLog(entry: Omit<BridgeLogEntry, "id">) {
  connectDebug.bridgeLog.push({ ...entry, id: nextLogId++ });
  if (connectDebug.bridgeLog.length > 60) {
    connectDebug.bridgeLog.splice(0, connectDebug.bridgeLog.length - 60);
  }
  console.debug("[blago bridge]", entry);
}

export function setConnectDebug(partial: Partial<ConnectDebugState>) {
  Object.assign(connectDebug, partial);
  console.debug("[blago connect]", partial);
}

export function addStatusHistory(entry: string) {
  connectDebug.statusHistory.push(entry);
  if (connectDebug.statusHistory.length > 30) {
    connectDebug.statusHistory.splice(0, connectDebug.statusHistory.length - 30);
  }
  console.debug("[blago status]", entry);
}

function snapshot() {
  return {
    inIframe: connectDebug.inIframe,
    referrer: connectDebug.referrer,
    bridgeInstalled: connectDebug.bridgeInstalled,
    gotTarget: connectDebug.gotTarget,
    hasJsProvider: connectDebug.hasJsProvider,
    targetInjected: connectDebug.targetInjected,
    targetEmbedded: connectDebug.targetEmbedded,
    targetAppName: connectDebug.targetAppName,
    hasJsProviderByKey: connectDebug.hasJsProviderByKey,
    connectResult: connectDebug.connectResult,
    connectError: connectDebug.connectError,
    connectMs: connectDebug.connectMs,
    connectorHasWallet: connectDebug.connectorHasWallet,
    uiHasWallet: connectDebug.uiHasWallet,
    uiConnected: connectDebug.uiConnected,
    bridgeHasTonconnect: connectDebug.bridgeHasTonconnect,
    jsBridgeKeyTarget: connectDebug.jsBridgeKeyTarget,
    fallback: connectDebug.fallback,
    statusHistory: [...connectDebug.statusHistory],
    bridgeLog: [...connectDebug.bridgeLog],
    unhandledRejections: [...connectDebug.unhandledRejections],
  };
}

// Монтируется при ?tcdbg=1: показывает состояние подключения прямо в приложении
// (в Telegram WebView нет консоли, поэтому рисуем поверх страницы).
export function ConnectDebugOverlay() {
  const show =
    new URLSearchParams(window.location.search).has("tcdbg") ||
    (() => {
      try {
        return window.localStorage.getItem("blagoTCDebug") === "1";
      } catch {
        return false;
      }
    })();
  if (!show) return null;

  return <LiveOverlay />;
}

const LiveOverlay = () => {
  const [, force] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => force((n) => n + 1), 500);
    return () => window.clearInterval(timer);
  }, []);

  const state = snapshot();

  const lines = state.bridgeLog.slice(-40).map((e) => {
    const meta = [e.dir, e.type, e.name, e.messageId]
      .filter(Boolean)
      .join(" ");
    return `${meta} :: ${e.summary}`;
  });

  return (
    <StyledOverlay>
      <pre>{JSON.stringify({
        inIframe: state.inIframe,
        referrer: state.referrer,
        bridgeInstalled: state.bridgeInstalled,
        gotTarget: state.gotTarget,
        hasJsProvider: state.hasJsProvider,
        targetInjected: state.targetInjected,
        targetEmbedded: state.targetEmbedded,
        targetAppName: state.targetAppName,
        hasJsProviderByKey: state.hasJsProviderByKey,
        connectResult: state.connectResult,
        connectError: state.connectError,
        connectMs: state.connectMs,
        connectorHasWallet: state.connectorHasWallet,
        uiHasWallet: state.uiHasWallet,
        uiConnected: state.uiConnected,
        bridgeHasTonconnect: state.bridgeHasTonconnect,
        jsBridgeKeyTarget: state.jsBridgeKeyTarget,
        fallback: state.fallback,
        statusHistory: state.statusHistory,
        unhandledRejections: state.unhandledRejections,
      }, null, 2)}</pre>
      <StyledLog>=== bridge log ==={lines.length ? "" : " (пусто)"}
{lines.join("\n")}</StyledLog>
    </StyledOverlay>
  );
};

const StyledOverlay = styled(Box)(({ theme }) => ({
  position: "fixed",
  top: 76,
  right: 12,
  zIndex: 99999,
  maxWidth: 360,
  padding: 12,
  fontSize: 12,
  fontFamily: "monospace",
  background: theme.palette.mode === "dark" ? "#111" : "#fff",
  color: theme.palette.mode === "dark" ? "#0f0" : "#000",
  border: "1px solid #ff5252",
  borderRadius: 8,
  whiteSpace: "pre-wrap",
  wordBreak: "break-all",
  pointerEvents: "none",
}));

const StyledLog = styled("pre")({
  maxHeight: 220,
  overflowY: "auto",
  margin: "8px 0 0",
  padding: 8,
  fontSize: 11,
  background: "rgba(0,0,0,0.06)",
});