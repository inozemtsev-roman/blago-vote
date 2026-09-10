import { Typography } from "@mui/material";
import { useTonConnectUI } from "@tonconnect/ui-react";

import React from "react";
import { Button } from "./Button";

export function ConnectButton({ className = "" }: { className?: string }) {
  const [tonConnectUI] = useTonConnectUI();

  const onConnect = () => {
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