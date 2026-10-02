import { Box, styled } from "@mui/material";

export interface ConnectDebugState {
  inIframe: boolean;
  referrer: string | null;
  bridgeInstalled: boolean;
  probe: null | boolean;
  probeMs: number;
  gotTarget: boolean;
  hasJsProvider: boolean;
  targetInjected: boolean;
  targetEmbedded: boolean;
  connectResult: null | boolean;
  connectError: string;
  connectMs: number;
  fallback: string;
}

export const connectDebug: ConnectDebugState = {
  inIframe: typeof window !== "undefined" && window.parent !== window,
  referrer: typeof window !== "undefined" ? document.referrer || null : null,
  bridgeInstalled: false,
  probe: null,
  probeMs: 0,
  gotTarget: false,
  hasJsProvider: false,
  targetInjected: false,
  targetEmbedded: false,
  connectResult: null,
  connectError: "",
  connectMs: 0,
  fallback: "",
};

export function setConnectDebug(partial: Partial<ConnectDebugState>) {
  Object.assign(connectDebug, partial);
  console.debug("[blago connect]", partial);
}

// Монтируется при ?tcdbg=1: показывает состояние подключения прямо в приложении
// (в Telegram WebView нет консоли, поэтому рисуем поверх страницы).
export function ConnectDebugOverlay() {
  const show = new URLSearchParams(window.location.search).has("tcdbg");
  if (!show) return null;

  return <Overlay state={{ ...connectDebug }} />;
}

const Overlay = ({ state }: { state: ConnectDebugState }) => {
  return (
    <StyledOverlay>
      <pre>{JSON.stringify(state, null, 2)}</pre>
    </StyledOverlay>
  );
};

const StyledOverlay = styled(Box)(({ theme }) => ({
  position: "fixed",
  top: 76,
  right: 12,
  zIndex: 99999,
  maxWidth: 320,
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