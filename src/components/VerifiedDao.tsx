import React from "react";
import { AppTooltip } from "./Tooltip";
import VerifiedImg from "assets/verified.svg";
import { styled } from "@mui/material";
import { StyledFlexRow } from "styles";
import { getIsVerifiedDao } from "utils";

export function VerifiedDao({ daoAddress = "" }: { daoAddress?: string }) {
  if (!getIsVerifiedDao(daoAddress)) {
    return null;
  }
  return (
    <AppTooltip
      text={
        <>
          Верифицированное ДАО. <br /> Это ДАО подтвердило право собственности на свой домен.
        </>
      }
    >
      <StyledContainer>
        <img src={VerifiedImg} alt="" />
      </StyledContainer>
    </AppTooltip>
  );
}

const StyledContainer = styled(StyledFlexRow)({
  width: "fit-content",
  flexShrink: 0,
  img: {
    display: "block",
    width: 22,
    height: 22,
  },
});
