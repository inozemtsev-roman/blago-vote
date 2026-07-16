import { Box, Fade, styled } from "@mui/material";
import React, { useState } from "react";
import { normalizeImageUrl } from "utils";
import { StyledSkeletonLoader } from "styles";

export function Img({
  src,
  className = "",
}: {
  src?: string;
  className?: string;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const normalizedSrc = normalizeImageUrl(src);
  const showPlaceholder = error ? true : isLoading ? false : !normalizedSrc;

  return (
    <StyledContainer className={`${className} img`}>
      {showPlaceholder ? (
        <StyledNoSrc />
      ) : (
        <>
          <Fade in={!isLoading}>
            <StyledImg
              referrerPolicy="no-referrer"
              onError={() => setError(true)}
              src={normalizedSrc}
              onLoad={() => setIsLoading(false)}
            />
          </Fade>
          <Fade in={isLoading}>
            <StyledLoader />
          </Fade>
        </>
      )}
    </StyledContainer>
  );
}

const StyledNoSrc = styled("div")({
  width: "100%",
  height: "100%",
  background: "rgba(211, 211, 211, 0.5)",
  position: "absolute",
});

const StyledImg = styled("img")({
  width: "100%",
  height: "100%",
  objectFit: "cover",
  position: "absolute",
  left: 0,
  top: 0,
});

const StyledLoader = styled(StyledSkeletonLoader)({
  position: "absolute",
  left: 0,
  top: 0,
  width: "100%",
  height: "100%",
});

const StyledContainer = styled(Box)({
  position: "relative",
  overflow: "hidden",
});
