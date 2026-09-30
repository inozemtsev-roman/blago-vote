import { Typography } from "@mui/material";
import { useTonConnectUI } from "@tonconnect/ui-react";

import React from "react";
import { Button } from "./Button";
import { tryConnectEmbeddedWallet } from "./connectEmbedded";

export function ConnectButton({ className = "" }: { className?: string }) {
  const [tonConnectUI] = useTonConnectUI();

  const onConnect = async () => {
    const embeddedConnected = await tryConnectEmbeddedWallet(tonConnectUI);
    if (embeddedConnected) return;
    tonConnectUI.openModal().catch((e) => {
      console.error("Не удалось открыть окно подключения кошелька:", e);
    });
  };

  return (
    <Button onClick={onConnect} className={className}>
      <Typography>Подключить кошелек</Typography>
    </Button>
  );
}