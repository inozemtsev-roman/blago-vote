import { styled, Typography } from "@mui/material";
import { Button, Popup } from "components";
import { FiCheck } from "react-icons/fi";
import { StyledFlexColumn, StyledFlexRow } from "styles";

interface Props {
  open: boolean;
  vote?: string;
  alreadyVoted?: boolean;
  onClose: () => void;
}

export function VoteSuccess({ open, vote, alreadyVoted, onClose }: Props) {
  return (
    <StyledPopup
      hideCloseButton
      title={alreadyVoted ? "Ваш голос уже принят" : "Ваш голос принят"}
      open={open}
    >
      <StyledContainer gap={22}>
        <StyledIcon>
          <FiCheck style={{ width: 22, height: 22 }} />
        </StyledIcon>
        <Typography className="subtitle">
          {alreadyVoted ? "Вы голосовали за:" : "Вы проголосовали за:"}
        </Typography>
        <StyledVoteLabel>{vote}</StyledVoteLabel>
        <Button onClick={onClose}>ОК</Button>
      </StyledContainer>
    </StyledPopup>
  );
}

const StyledPopup = styled(Popup)({
  maxWidth: 400,
  padding: 0,
});

const StyledContainer = styled(StyledFlexColumn)({
  padding: "10px 10px 16px",
  ".subtitle": {
    fontSize: 15,
    fontWeight: 500,
    color: "rgba(114, 138, 150, 1)",
  },
});

const StyledIcon = styled(StyledFlexRow)(({ theme }) => ({
  width: 56,
  height: 56,
  borderRadius: "50%",
  background: theme.palette.primary.main,
  color: "#fff",
  justifyContent: "center",
}));

const StyledVoteLabel = styled(Typography)(({ theme }) => ({
  textTransform: "capitalize",
  fontWeight: 700,
  fontSize: 17,
  textAlign: "center",
  color: theme.palette.mode === "light" ? theme.palette.primary.main : "#fff",
}));