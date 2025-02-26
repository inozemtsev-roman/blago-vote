import { styled, Typography } from '@mui/material'
import React from 'react'
import { StyledFlexColumn, StyledFlexRow } from 'styles'
import GradospheraLogo from 'assets/gradosphera.svg'
import { AppSocials, Github } from 'components';

export function Footer() {
  return (
    <StyledContainer>
      <StyledWithLove> <img src={GradospheraLogo} />
        <Typography>ДАО</Typography>
        <a href="https://gradosphera.org" target="_blank">
          <Typography>Градосфера</Typography> 
        </a>
      </StyledWithLove>
      <StyledFlexRow gap={0}>
        <StyledSocials />
      </StyledFlexRow>
    </StyledContainer>
  );
}

const StyledSocials = styled(AppSocials)(({ theme }) => ({
  width: "auto",
  svg: {
    color: theme.palette.mode === 'light' && theme.palette.primary.main,
  },
}));


const StyledContainer = styled(StyledFlexColumn)(({ theme }) => ({
    marginTop:100,
    height: 100,
  a: {
    textDecoration: "unset",
    color: theme.palette.primary.main,
    display:'flex',
    alignItems:'center',
    gap: 5
  },
  "*": {
    fontWeight: 500,
    fontSize: '14px!important',
  },
  img: {
    width: 18,
  },
}));

const StyledWithLove = styled(StyledFlexRow)({
   gap:4
})