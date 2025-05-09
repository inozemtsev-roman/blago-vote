import { IconButton, styled, useTheme, useThemeProps } from "@mui/material";
import { useTonAddress } from "@tonconnect/ui-react";
import { AppTooltip, Button, Img } from "components";
import { DevParametersModal } from "components/DevParameters";
import { IS_DEV, TELEGRAM_SUPPORT_GROUP } from "config";
import { TOOLBAR_WIDTH } from "consts";
import { useDevFeatures, useMobile, useRole } from "hooks/hooks";
import { useDaosPageTranslations } from "i18n/hooks/useDaosPageTranslations";
import { useDaosQuery } from "query/getters";
import { AiOutlinePlus } from "react-icons/ai";
import { Link, useParams } from "react-router-dom";
import { appNavigation, useAppNavigation } from "router/navigation";
import { StyledFlexColumn, StyledFlexRow } from "styles";
import { getBorderColor } from "theme";
import { parseLanguage } from "utils";
import { IoHelpSharp } from "react-icons/io5";
import { useMemo } from "react";
import { Address } from "ton";
import { Dao } from "types";

export function Toolbar() {
  const navigation = useAppNavigation();
  const translations = useDaosPageTranslations();
  const devFeatures = useDevFeatures();
  const mobile = useMobile();
  const theme = useTheme();
  const { createSpace } = useAppNavigation();
  if (mobile) return null;

  return (
    <StyledToolbar>
      <StyledFlexColumn gap={20}>
        <DevParametersModal />
        <AppTooltip text="Создать новое пространство для вашего ДАО" placement="right">
          <StyledButton
            onClick={createSpace.root}
            variant="transparent"
          >
            <AiOutlinePlus />
          </StyledButton>
        </AppTooltip>
      </StyledFlexColumn>
      <UserDaos />
      <StyledSupportTooltip placement="right" text="Служба поддержки">
        <StyledSupport
          variant="transparent"
          onClick={() => window.open(TELEGRAM_SUPPORT_GROUP, "_target")}
        >
          <IoHelpSharp
            style={{ width: 30, height: 30, color: theme.palette.primary.main }}
          />
        </StyledSupport>
      </StyledSupportTooltip>
    </StyledToolbar>
  );
}

const StyledSupportTooltip = styled(AppTooltip)({
  marginTop: "auto",
  cursor: "pointer",
  marginBottom: 20,
});

const StyledButton = styled(Button)({
  borderRadius: "50%",
  cursor: "pointer",
  padding: 10,
  width: 40,
  height: 40,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  svg: {
    width: 20,
    height: 20,
  },
});
const StyledSupport = styled(StyledButton)({
});
const StyledToolbar = styled(StyledFlexColumn)(({ theme }) => ({
  width: TOOLBAR_WIDTH,
  height: "100%",
  background: theme.palette.background.paper,
  position: "fixed",
  left: 0,
  borderRight: `0.5px solid ${getBorderColor(theme.palette.mode)}`,
  zIndex: 30,
  top: 0,
  justifyContent: "flex-start",
  paddingTop: 20,
  gap: 0,
}));

const DaoItem = ({ dao, selected, nonBounceableWallet }: { 
  dao: Dao; 
  selected: boolean;
  nonBounceableWallet: string;
}) => {
  const nonBounceableOwner = useMemo(() => {
    try {
      const parsedAddress = Address.parse(dao.daoRoles.owner);
      return parsedAddress.toString({ bounceable: false });
    } catch {
      return dao.daoRoles.owner;
    }
  }, [dao.daoRoles.owner]);

  const nonBounceableProposalOwner = useMemo(() => {
    try {
      const parsedAddress = Address.parse(dao.daoRoles.proposalOwner);
      return parsedAddress.toString({ bounceable: false });
    } catch {
      return dao.daoRoles.proposalOwner;
    }
  }, [dao.daoRoles.proposalOwner]);

  const isOwner = nonBounceableWallet === nonBounceableOwner;
  const isProposalPublisher = nonBounceableWallet === nonBounceableProposalOwner;

  if (!isOwner && !isProposalPublisher) {
    return null;
  }

  return (
    <StyledLink
      selected={selected ? 1 : 0}
      to={appNavigation.daoPage.root(dao.daoAddress)}
      key={dao.daoAddress}
    >
      <AppTooltip
        text={parseLanguage(dao.daoMetadata.metadataArgs.name)}
        placement="right"
      >
        <StyledDaoImg src={dao.daoMetadata.metadataArgs.avatar} />
      </AppTooltip>
    </StyledLink>
  );
};

const UserDaos = () => {
  const { data: daos } = useDaosQuery();
  const connectedWallet = useTonAddress();
  const daoId = useParams().daoId;

  const nonBounceableWallet = useMemo(() => {
    if (!connectedWallet) return "";
    try {
      const parsedAddress = Address.parse(connectedWallet);
      return parsedAddress.toString({ bounceable: false });
    } catch {
      return connectedWallet;
    }
  }, [connectedWallet]);

  const nonBounceableDaoId = useMemo(() => {
    if (!daoId) return "";
    try {
      const parsedAddress = Address.parse(daoId);
      return parsedAddress.toString({ bounceable: false });
    } catch {
      return daoId;
    }
  }, [daoId]);

  console.log('Connected wallet:', connectedWallet);
  console.log('Non-bounceable wallet:', nonBounceableWallet);
  console.log('DAOs:', daos);

  if (!connectedWallet) {
    return null;
  }

  return (
    <StyledUserDaos>
      {daos?.map((dao) => (
        <DaoItem
          key={dao.daoAddress}
          dao={dao}
          selected={nonBounceableDaoId === dao.daoAddress}
          nonBounceableWallet={nonBounceableWallet}
        />
      ))}
    </StyledUserDaos>
  );
};

const StyledLink = styled(Link)<{ selected: number }>(({ selected, theme }) => {
  const shadow =
    theme.palette.mode === "light"
      ? "0px -1px 24px 4px rgba(0,136,204,1)"
      : "0px -1px 15px 4px rgba(255,255,255,0.2)";
  return {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 5,
    transition: "0.2s all",
    boxShadow: selected === 1 ? shadow : "unset",
    borderRadius: "50%",
  };
});

const StyledDaoImg = styled(Img)({
  width: 40,
  height: 40,
  borderRadius: "50%",
});

const StyledUserDaos = styled(StyledFlexColumn)({
  flex: 1,
  gap: 20,
  overflow: "auto",
  paddingBottom: 50,
  justifyContent: "flex-start",
  paddingTop: 20,
});
