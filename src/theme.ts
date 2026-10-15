import { createTheme, Theme } from "@mui/material";
import { useAppSettings } from "hooks/hooks";
import { useEffect } from "react";
import { useSettingsStore } from "store";

// Palette is based on the getgems design tokens. Only the light and dark schemes are kept.
const lightAccent = "#3069ff";
const darkAccent = "#3069ff";
const lightBorder = "rgba(19, 19, 20, 0.16)";
const darkBorder = "rgba(229, 229, 234, 0.2)";

export const lightTheme = createTheme({
  palette: {
    mode: "light",
    background: {
      default: "#f3f3f5",
      paper: "#ffffff",
    },
    divider: lightBorder,
    error: {
      main: "#e64646",
    },
    primary: {
      main: lightAccent,
    },
    text: {
      primary: "#000000",
      secondary: "#8a8a93",
    },
  },

  typography: {
    allVariants: {
      color: "#000000",
      fontFamily: "inter",
    },
    h1: {
      fontSize: 44,
      fontWeight: 800,
      color: "#000000",
    },
    h2: {
      fontSize: 20,
      fontWeight: 800,
      color: "#000000",
    },
    h4: {
      fontSize: 20,
      fontWeight: 800,
      color: "#000000",
    },
    fontFamily: "inter",
  },
});

export const darkTheme = createTheme({
  palette: {
    mode: "dark",
    background: {
      default: "#09090a",
      paper: "#131314",
    },
    divider: darkBorder,
    error: {
      main: "#ff5c5c",
    },
    primary: {
      main: darkAccent,
    },
    text: {
      primary: "#e5e5ea",
      secondary: "#7d7d85",
    },
  },

  typography: {
    allVariants: {
      color: "#e5e5ea",
      fontFamily: "inter",
    },
    h1: {
      fontSize: 44,
      fontWeight: 800,
      color: "#e5e5ea",
    },
    h2: {
      fontSize: 20,
      fontWeight: 800,
      color: "#e5e5ea",
    },
    h4: {
      fontSize: 20,
      fontWeight: 800,
      color: "#e5e5ea",
    },
    fontFamily: "inter",
  },
});

export const getBorderColor = (mode: "light" | "dark") => {
  return mode === "light" ? lightBorder : darkBorder;
};

export const useInitThemeMode = () => {
  const { themeMode, setThemeMode } = useAppSettings();

  useEffect(() => {
    if (themeMode) return;
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setThemeMode(isDark ? "dark" : "light");
  }, []);
};
