import { styled } from "@mui/material";
import type { CSSProperties } from "react";

// Иконки Telegram (community Figma UI-киты, CC BY 4.0). Полный набор лежит в
// репозитории telegram-icons, здесь — только используемое подмножество, см.
// src/assets/telegram-icons/README.md.
//
// Набор выбирается по платформе устройства: iOS-кит на iPhone/iPad/iPod,
// Android-кит — на Android. Если для платформы иконки нет, берём iOS-вариант.
const FILES = import.meta.glob("/src/assets/telegram-icons/*/*.svg", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

type SetName = "ios" | "android";

const REGISTRY = {
  home: { ios: "house", android: "house_plus_outline" },
  dao: { ios: "ic_group", android: "settings_group" },
  wallet: { ios: "wallet", android: "wallet" },
  moon: { ios: "ic_lt_darkmode", android: "moon" },
  sun: { ios: "brightness_max", android: "sun" },
  calendar: { ios: "calendar", android: "calendar" },
  calendarEnd: { ios: "calendar", android: "calendar_up" },
  clock: { ios: "clock", android: "clock" },
  link: { ios: "link", android: "link" },
  strategy: { ios: "Stats", android: "stat" },
  coins: { ios: "coins", android: "banknotes" },
  nft: { ios: "nft", android: "pic" },
  results: { ios: "stats-2", android: "statistic" },
  votes: { ios: "checkmark", android: "check_circle_outline" },
  location: { ios: "location", android: "geo_outline" },
  info: { ios: "circleinfooutlined", android: "info_circle_outline" },
  users: { ios: "ic_group", android: "users" },
  choiceFor: { ios: "checkmarkfill", android: "check_circle_filled" },
  choiceAgainst: { ios: "circlecancel", android: "close_circle_filled" },
  choiceAbstain: { ios: "circleminusfill", android: "minus_circle_outline" },
} as const;

export type TgIconName = keyof typeof REGISTRY;

function detectSet(): SetName {
  if (typeof navigator === "undefined") return "ios";
  return /Android/i.test(navigator.userAgent || "") ? "android" : "ios";
}

const PLATFORM_SET: SetName = detectSet();

function getSvg(name: TgIconName): string | undefined {
  const entry = REGISTRY[name] as { ios: string; android: string };
  const other: SetName = PLATFORM_SET === "ios" ? "android" : "ios";
  return (
    FILES[`/src/assets/telegram-icons/${PLATFORM_SET}/${entry[PLATFORM_SET]}.svg`] ??
    FILES[`/src/assets/telegram-icons/${other}/${entry[other]}.svg`]
  );
}

interface Props {
  name: TgIconName;
  size?: number;
  color?: string;
  className?: string;
  style?: CSSProperties;
}

export function TgIcon({ name, size = 20, color, className, style }: Props) {
  const svg = getSvg(name);
  if (!svg) return null;
  return (
    <StyledTgIcon
      className={className}
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        ...(color ? { color } : {}),
        ...style,
      }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

const StyledTgIcon = styled("span")({
  display: "inline-flex",
  flexShrink: 0,
  alignItems: "center",
  justifyContent: "center",
  lineHeight: 0,
  color: "inherit",
  svg: {
    display: "block",
    width: "100%",
    height: "100%",
  },
});
