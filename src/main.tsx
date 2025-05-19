import ReactDOM from "react-dom/client";
import { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { CssBaseline } from "@mui/material";
import "./i18n/index";
import App from "App";
import { THEME, TonConnectUIProvider } from "@tonconnect/ui-react";
import { manifestUrl } from "config";
import { clearAllToasts } from "toasts";
import { useSettingsStore } from "store";
import { TonConnectInitializer } from "components/TonConnectInitializer";
import TelegramAnalytics from '@telegram-apps/analytics'

TelegramAnalytics.init({
  token:
    "eyJhcHBfbmFtZSI6IkdyYWRvc3BoZXJhX1ZvdGUiLCJhcHBfdXJsIjoiaHR0cHM6Ly90Lm1lL2dyYWRvc3BoZXJhX3ZvdGVfYm90IiwiYXBwX2RvbWFpbiI6Imh0dHBzOi8vdm90ZS5ncmFkb3NwaGVyYS5vcmcvRVFERXhscDZFamtWTi1PSjFaY0dMRVlsSVRhb2xkNXl0QlAzZThnNmdfQklSYVpYIn0=!/ZVr7tFUH54VuCCAPRZimip/DlmF7/U+E2lM4/hQeIo=",
  appName: "Gradosphera_Vote",
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false
    },
    mutations: {
      onMutate: () => clearAllToasts(),
    },
  },
});
const defaultTheme =
  useSettingsStore.getState().themeMode === "dark" ? THEME.DARK : THEME.LIGHT;
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <QueryClientProvider client={queryClient}>
    <CssBaseline />

    <TonConnectUIProvider
      manifestUrl={manifestUrl}
      uiPreferences={{
        theme: defaultTheme
      }}
    >
      <TonConnectInitializer />
      <App />
    </TonConnectUIProvider>

    

    {/* <ReactQueryDevtools /> */}
  </QueryClientProvider>
);
