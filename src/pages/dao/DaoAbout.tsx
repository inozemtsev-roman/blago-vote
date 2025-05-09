import { Chip, styled } from "@mui/material";
import { AddressDisplay, TitleContainer } from "components";
import { useAppParams } from "hooks/hooks";
import { useTonAddress } from "@tonconnect/ui-react";
import { useCommonTranslations } from "i18n/hooks/useCommonTranslations";
import { useDaoQuery } from "query/getters";
import { StyledFlexColumn, StyledFlexRow } from "styles";
import { LayoutSection } from "./components";
import { DaoDescription } from "./DaoDescription";
import { useMemo } from "react";
import { Address } from "ton";

const StyledYouChip = styled(Chip)({
  backgroundColor: "#0088CC",
  color: "white",
  fontSize: "12px",
  height: "24px",
  "& .MuiChip-label": {
    padding: "0 8px",
  },
});

const StyledSection = styled(StyledFlexRow)({
  gap: 30,
  justifyContent: "space-between",
  padding: "14px 25px",
  borderBottom: "1px solid rgba(114, 138, 150, 0.24)",
  "&:last-child": {
    border: "unset",
  },
});

const StyledAddressContainer = styled(StyledFlexRow)({
  gap: 10,
  width: 400,
  alignItems: "center",
});

const StyledAddressWrapper = styled(StyledFlexRow)({
  gap: 10,
  alignItems: "center",
  flex: 1,
});

const StyledRoleChip = styled(Chip)({
  marginLeft: "auto",
});

export function DaoAbout() {
    const { daoAddress } = useAppParams();
    const connectedWallet = useTonAddress();

  const roles = useDaoQuery(daoAddress).data?.daoRoles;
  const translations = useCommonTranslations();

  const nonBounceableWallet = useMemo(() => {
    if (!connectedWallet) return "";
    try {
      const parsedAddress = Address.parse(connectedWallet);
      return parsedAddress.toString({ bounceable: false });
    } catch {
      return connectedWallet;
    }
  }, [connectedWallet]);

  const nonBounceableOwner = useMemo(() => {
    if (!roles?.owner) return "";
    try {
      const parsedAddress = Address.parse(roles.owner);
      return parsedAddress.toString({ bounceable: false });
    } catch {
      return roles.owner;
    }
  }, [roles?.owner]);

  const nonBounceableProposalOwner = useMemo(() => {
    if (!roles?.proposalOwner) return "";
    try {
      const parsedAddress = Address.parse(roles.proposalOwner);
      return parsedAddress.toString({ bounceable: false });
    } catch {
      return roles.proposalOwner;
    }
  }, [roles?.proposalOwner]);

  const isOwner = nonBounceableWallet === nonBounceableOwner;
  const isProposalPublisher = nonBounceableWallet === nonBounceableProposalOwner;

  return (
    <LayoutSection title="Описание ДАО">
      <DaoDescription />
      <StyledTitleContainer
        title={translations.administrators}
        headerComponent={<Chip label={2} />}
      >
        <StyledFlexColumn gap={0}>
          <StyledSection>
            <StyledAddressContainer>
              <StyledAddressWrapper>
                {roles && (
                  <StyledAddressDisplay address={nonBounceableOwner} padding={10} />
                )}
                {isOwner && <StyledYouChip label="Это вы" />}
              </StyledAddressWrapper>
            </StyledAddressContainer>
            <StyledRoleChip label={translations.daoSpaceOwner} color="primary" />
          </StyledSection>
          <StyledSection>
            <StyledAddressContainer>
              <StyledAddressWrapper>
                {roles && (
                  <StyledAddressDisplay
                    address={nonBounceableProposalOwner}
                    padding={10}
                  />
                )}
                {isProposalPublisher && <StyledYouChip label="Это вы" />}
              </StyledAddressWrapper>
            </StyledAddressContainer>
            <StyledRoleChip label={translations.proposalPublisher} color="primary" />
          </StyledSection>
        </StyledFlexColumn>
      </StyledTitleContainer>
    </LayoutSection>
  );
}

export default DaoAbout;


const StyledAddressDisplay = styled(AddressDisplay)({
  P: {
    fontWeight: 600,
  },
  width: "100%",
  textAlign: "left",
});

const StyledTitleContainer = styled(TitleContainer)({
  ".title-container-header": {
    justifyContent: "flex-start",
  },
  ".title-container-children": {
    padding: 0,
  },
});
