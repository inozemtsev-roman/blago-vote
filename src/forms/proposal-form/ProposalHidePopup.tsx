import { styled, Typography } from "@mui/material";
import { Button, Popup } from "components";
import React from "react";
import { StyledFlexColumn, StyledFlexRow } from "styles";
import { ProposalHidePopupVariant } from "types";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: () => void;
  variant: ProposalHidePopupVariant;
}

function ProposalHidePopup({ open, onClose, onSubmit, variant }: Props) {
  const content = useGetContent(variant);

  return (
    <StyledPopup open={open} onClose={onClose} title='Видимость предложения'>
      <StyledFlexColumn gap={40}>
        <StyledContent>{content}</StyledContent>
        <StyledButtons>
          <Button variant='transparent' onClick={onClose}>Отмена</Button>
          <Button onClick={onSubmit}>Подтвердить</Button>
        </StyledButtons>
      </StyledFlexColumn>
    </StyledPopup>
  );
}

const useGetContent = (variant: ProposalHidePopupVariant) => {
  if (variant === "hide") {
    return "Это предложение будет скрыто из списка предложений. Вы можете изменить его позже в разделе настроек.";
  }
  if (variant === "changed-to-hide") {
    return "Это предложение будет скрыто из списка предложений. Вы можете изменить его позже в разделе настроек.";
  }
  return "Это предложение будет видно в списке предложений.";
};

export default ProposalHidePopup;

const StyledContent = styled(Typography)({
  fontSize: 17,
  fontWeight: 600,
});

const StyledButtons = styled(StyledFlexRow)({
    gap: 20,
    button:{
        width:'50%'
    }
})

const StyledPopup = styled(Popup)({
  maxWidth: 500,
});
