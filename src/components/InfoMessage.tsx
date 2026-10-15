import { Box, styled } from "@mui/material";
import React from "react";

import { Markdown } from "./Markdown";

export function InfoMessage({ message }: { message: string }) {
  const value = `${message}` as any;
  return (
    <StyledContainer>
      <Markdown>{value}</Markdown>
    </StyledContainer>
  );
}

const StyledContainer = styled(Box)(({ theme }) => ({
  padding: 15,
  borderRadius: 10,
  border: `1px solid ${
    theme.palette.mode === "dark" ? "rgba(229,229,234,0.3)" : "rgba(19,19,20,0.24)"
  }`,
  p: {
    fontSize: 16,
    fontWeight: 600,
  },
}));
