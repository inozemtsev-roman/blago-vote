import ReactDOM from "react-dom/client";
import { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { CssBaseline } from "@mui/material";
import "./i18n/index";
import App from "App";
import { THEME, TonConnectUIProvider } from "@tonconnect/ui-react";
import { clearAllToasts } from "toasts";
import { useSettingsStore } from "store";
import { TonConnectInitializer } from "components/TonConnectInitializer";
import { tonConnect } from "tonConnect";

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

// Кошелёк ДАО Градосфера — главный в меню подключения TON-кошелька
try {
  localStorage.setItem("ton-connect-ui_preferred-wallet", "gradospherawallet");
} catch {
  // локальное хранилище может быть недоступно (например, приватный режим) —
  // в таком случае просто оставляем стандартный порядок кошельков
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <QueryClientProvider client={queryClient}>
    <CssBaseline />

    <TonConnectUIProvider
      connector={tonConnect}
      analytics={{ mode: "off" }}
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
