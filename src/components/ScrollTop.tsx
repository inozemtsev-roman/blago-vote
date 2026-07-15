import { Box, Fade, styled } from "@mui/material";
import { useEffect, useState } from "react";
import { isMobile } from "react-device-detect";
import { BsArrowUpShort } from "react-icons/bs";
import { IoChevronDown, IoChevronUp } from "react-icons/io5";
import { TOOLBAR_WIDTH } from "consts";
import { useSettingsStore } from "store";

function ScrollTop() {
  const [show, setShow] = useState(false);
  const sidebarHidden = useSettingsStore((s) => s.sidebarHidden);
  const toggleSidebar = useSettingsStore((s) => s.toggleSidebar);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 400);
    window.addEventListener("scroll", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <StyledContainer raised={!sidebarHidden}>
      <StyledToggleBtn
        onClick={toggleSidebar}
        aria-label={sidebarHidden ? "Показать панель" : "Скрыть панель"}
      >
        {sidebarHidden ? <IoChevronUp /> : <IoChevronDown />}
      </StyledToggleBtn>
      <Fade in={show}>
        <StyledScrollBtn onClick={() => window.scrollTo({ top: 0, left: 0 })}>
          <BsArrowUpShort style={{ width: 35, height: 35, color: "white" }} />
        </StyledScrollBtn>
      </Fade>
    </StyledContainer>
  );
}

export default ScrollTop;

const StyledContainer = styled(Box, {
  shouldForwardProp: (prop) => prop !== "raised",
})<{ raised: boolean }>(({ raised }) => ({
  position: "fixed",
  bottom: raised ? TOOLBAR_WIDTH + 16 : 20,
  right: isMobile ? 20 : 24,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 8,
  zIndex: 100,
  transition: "bottom 0.2s",
}));

const StyledToggleBtn = styled("button")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 45,
  height: 45,
  borderRadius: "50%",
  cursor: "pointer",
  background: theme.palette.primary.main,
  color: "#fff",
  border: "unset",
  svg: { width: 22, height: 22 },
  transition: "0.1s all",
  "&:hover": {
    transform: "scale(1.1)",
  },
}));

const StyledScrollBtn = styled("button")(({ theme }) => ({
  zIndex: 100,
  background: theme.palette.primary.main,
  borderRadius: "50%",
  border: "unset",
  width: 45,
  height: 45,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "0.1s all",
  "&:hover": {
    transform: "scale(1.1)",
  },
}));
