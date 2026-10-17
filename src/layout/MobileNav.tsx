import { Box, styled } from "@mui/material";
import { Link, useLocation } from "react-router-dom";
import { MOBILE_WIDTH, TOOLBAR_WIDTH } from "consts";
import { appNavigation } from "router/navigation";
import { TgIcon } from "components";
import type { TgIconName } from "components";

// Нижняя навигация для мобильной версии / Telegram Mini App:
// 3 кнопки с иконками из набора Telegram.
//   🏠 «на главную»   -> "/"
//   🗳 «ДАО»          -> "/manage" (страница ДАО пользователя)
//   👛 «мультикошелек»-> "/multisig"
//
// По умолчанию показана только иконка (по центру кнопки). У активной кнопки
// появляется подпись, иконка чуть приподнимается и окрашивается в цвет подписи;
// при переходе на другую кнопку подпись пропадает, а иконка возвращается назад.
const ITEMS: { label: string; icon: TgIconName; to: string }[] = [
  { label: "Главная", icon: "home", to: appNavigation.daosPage.root() },
  { label: "ДАО", icon: "dao", to: appNavigation.managePage.root() },
  {
    label: "Мультикошелек",
    icon: "wallet",
    to: appNavigation.multisigPage.root(),
  },
];

const ICON_SIZE = 30;

export function MobileNav() {
  const location = useLocation();

  const isActive = (item: (typeof ITEMS)[number]) => {
    if (item.icon === "wallet") return location.pathname.startsWith("/multisig");
    if (item.icon === "dao") return location.pathname === "/manage";
    return location.pathname === "/";
  };

  return (
    <StyledContainer>
      {ITEMS.map((item) => {
        const active = isActive(item) ? 1 : 0;
        return (
          <StyledLink key={item.to} to={item.to} $active={active} aria-label={item.label}>
            <StyledIcon $active={active}>
              <TgIcon name={item.icon} size={ICON_SIZE} />
            </StyledIcon>
            <StyledLabel $active={active}>{item.label}</StyledLabel>
          </StyledLink>
        );
      })}
    </StyledContainer>
  );
}

// Плавающее полупрозрачное меню: скруглённые бока, небольшой отступ снизу
// (поверх safe-area), размытие фона под ним.
const StyledContainer = styled(Box)(({ theme }) => {
  const dark = theme.palette.mode === "dark";
  return {
    display: "none",
    [`@media (max-width: ${MOBILE_WIDTH}px)`]: {
      display: "flex",
      position: "fixed",
      left: 12,
      right: 12,
      bottom: `calc(8px + env(safe-area-inset-bottom, 0px))`,
      height: TOOLBAR_WIDTH,
      boxSizing: "border-box",
      borderRadius: TOOLBAR_WIDTH / 2,
      background: dark ? "rgba(19, 19, 20, 0.72)" : "rgba(255, 255, 255, 0.72)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      boxShadow: dark
        ? "0 6px 24px rgba(0, 0, 0, 0.45)"
        : "0 6px 24px rgba(0, 0, 0, 0.12)",
      overflow: "hidden",
      zIndex: 30,
    },
  };
});

const StyledLink = styled(Link, {
  shouldForwardProp: (prop) => prop !== "$active",
})<{ $active: number }>(({ theme, $active }) => ({
  flex: 1,
  position: "relative",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  color: $active ? theme.palette.primary.main : theme.palette.text.secondary,
  transition: "color 0.2s ease",
}));

const StyledIcon = styled(Box, {
  shouldForwardProp: (prop) => prop !== "$active",
})<{ $active: number }>(({ $active }) => ({
  width: ICON_SIZE,
  height: ICON_SIZE,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "inherit",
  transform: $active ? "translateY(-7px)" : "translateY(0)",
  transition: "transform 0.2s ease",
}));

const StyledLabel = styled(Box, {
  shouldForwardProp: (prop) => prop !== "$active",
})<{ $active: number }>(({ $active }) => ({
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 7,
  textAlign: "center",
  fontSize: 11,
  fontWeight: 600,
  lineHeight: 1,
  color: "inherit",
  whiteSpace: "nowrap",
  opacity: $active ? 1 : 0,
  transform: $active ? "translateY(0)" : "translateY(4px)",
  transition: "opacity 0.2s ease, transform 0.2s ease",
  pointerEvents: "none",
}));
