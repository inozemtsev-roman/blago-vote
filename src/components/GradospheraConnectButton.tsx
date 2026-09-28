import { Box, Typography, styled } from "@mui/material";
import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { isMobile } from "react-device-detect";
import { MOBILE_WIDTH } from "consts";
import { Img } from "./Img";
import { StyledFlexRow } from "styles";

const GRADOSPHERA_WALLET_APP_NAME = "gradospherawallet";
const WALLET_TELEGRAM_IMAGE = "https://wallet.tg/images/logo-288.png";

export function GradospheraConnectButton({
  className = "",
}: {
  className?: string;
}) {
  const [tonConnectUI] = useTonConnectUI();
  const connected = !!useTonWallet();

  const onConnect = async () => {
    if (connected) return;
    try {
      const wallets = await tonConnectUI.getWallets();
      const target = wallets.find(
        (wallet) => wallet.appName === GRADOSPHERA_WALLET_APP_NAME
      );

      if (!target) {
        await tonConnectUI.openModal();
        return;
      }

      if ("jsBridgeKey" in target && target.injected) {
        await tonConnectUI.connector.connect({
          jsBridgeKey: target.jsBridgeKey,
        });
        return;
      }

      if (!("universalLink" in target) || !("bridgeUrl" in target)) {
        await tonConnectUI.openSingleWalletModal(target.appName);
        return;
      }

      const link = tonConnectUI.connector.connect({
        universalLink: target.universalLink,
        bridgeUrl: target.bridgeUrl,
      });
      if (isMobile) {
        window.location.href = link;
      } else {
        const opened = window.open(link, "_blank", "noopener");
        if (!opened) {
          window.location.href = link;
        }
      }
    } catch (e) {
      console.error("Не удалось подключить кошелёк ДАО Градосфера:", e);
    }
  };

  if (connected) return null;

  return (
    <StyledButton onClick={onConnect} className={className}>
      <StyledLogoWrap>
        <Img src={WALLET_TELEGRAM_IMAGE} />
      </StyledLogoWrap>
      <Typography>Кошелек ДАО Градосфера в Telegram</Typography>
    </StyledButton>
  );
}

const StyledButton = styled(StyledFlexRow)(({ theme }) => ({
  cursor: "pointer",
  width: "fit-content",
  gap: 12,
  minWidth: 320,
  background: theme.palette.background.paper,
  border:
    theme.palette.mode === "light"
      ? "1px solid #e0e0e0"
      : "1px solid rgba(255,255,255, 0.2)",
  borderRadius: 12,
  padding: "10px 18px",
  transition: "0.2s all",
  p: {
    fontSize: 15,
    fontWeight: 700,
  },
  "&:hover": {
    border: `1px solid ${theme.palette.primary.main}`,
  },
  [`@media (max-width: ${MOBILE_WIDTH}px)`]: {
    minWidth: "unset",
    width: "100%",
  },
}));

const StyledLogoWrap = styled(Box)({
  width: 38,
  height: 38,
  borderRadius: "50%",
  overflow: "hidden",
  flexShrink: 0,
});