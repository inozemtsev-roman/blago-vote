import { LinearProgress, styled } from "@mui/material";

export function Progress({
  progress,
  color,
}: {
  progress: number;
  color?: string;
}) {
  return <StyledContainer variant="determinate" value={progress} barColor={color} />;
}

const StyledContainer = styled(LinearProgress, {
  shouldForwardProp: (prop) => prop !== "barColor",
})<{ barColor?: string }>(({ barColor }) => ({
  height: 10,
  borderRadius: 10,
  width: "100%",
  ...(barColor
    ? {
        "& .MuiLinearProgress-bar": {
          backgroundColor: barColor,
        },
      }
    : {}),
}));