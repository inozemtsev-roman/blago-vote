import { Box, styled } from "@mui/material";
import { useTonAddress } from "@tonconnect/ui-react";
import { AppTooltip, Button, Img } from "components";
import { DevParametersModal } from "components/DevParameters";
import { TOOLBAR_WIDTH } from "consts";
import { useRole } from "hooks/hooks";
import { useDaosQuery } from "query/getters";
import { AiOutlinePlus } from "react-icons/ai";
import { Link, useParams } from "react-router-dom";
import { useSettingsStore } from "store";
import { appNavigation, useAppNavigation } from "router/navigation";
import { getBorderColor } from "theme";
import { parseLanguage } from "utils";


export function Toolbar() {
  const sidebarHidden = useSettingsStore((s) => s.sidebarHidden);
  const { createSpace } = useAppNavigation();

  return (
    <StyledToolbar expanded={!sidebarHidden}>
      {!sidebarHidden && (
        <StyledToolbarContent>
          <StyledTopArea>
            <DevParametersModal />
            <StyledCreateArea>
              <AppTooltip text="Создать новое ДАО" placement="top">
                <StyledButton onClick={createSpace.root} variant="transparent">
                  <AiOutlinePlus />
                </StyledButton>
              </AppTooltip>
            </StyledCreateArea>
          </StyledTopArea>
          <UserDaos />
        </StyledToolbarContent>
      )}
    </StyledToolbar>
  );
}

const StyledCreateArea = styled(Box)({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
});

const StyledTopArea = styled(Box)({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: 8,
  paddingLeft: 8,
  height: "100%",
});

const StyledToolbar = styled(Box, {
  shouldForwardProp: (prop) => prop !== "expanded",
})<{ expanded: boolean }>(({ theme, expanded }) => ({
  height: expanded ? TOOLBAR_WIDTH : 0,
  width: "100%",
  background: theme.palette.background.paper,
  position: "fixed",
  left: 0,
  bottom: 0,
  transition: "height 0.2s",
  borderTop: expanded
    ? `0.5px solid ${getBorderColor(theme.palette.mode)}`
    : "none",
  boxShadow: expanded
    ? theme.palette.mode === "dark"
      ? "0 -4px 16px rgba(0,0,0,0.35)"
      : "0 -4px 16px rgba(0,0,0,0.08)"
    : "none",
  zIndex: 30,
  overflow: "hidden",
}));

const StyledToolbarContent = styled(Box)({
  height: "100%",
  gap: 0,
  minHeight: TOOLBAR_WIDTH,
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  padding: "0 12px",
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
  svg: { width: 20, height: 20 },
});

const UserDaos = () => {
  const { data: daos } = useDaosQuery();
  const connectedWallet = useTonAddress();

  const { getRole } = useRole();

  const daoId = useParams().daoId;

  if (!connectedWallet) {
    return null;
  }

  return (
    <StyledUserDaos>
      {daos &&
        daos?.map((dao) => {
          const { isOwner, isProposalPublisher } = getRole(dao.daoRoles);

          if (isOwner || isProposalPublisher) {
            const selected = daoId === dao.daoAddress;
            return (
              <StyledLink
                selected={selected ? 1 : 0}
                to={appNavigation.daoPage.root(dao.daoAddress)}
                key={dao.daoAddress}
              >
                <AppTooltip
                  text={parseLanguage(dao.daoMetadata.metadataArgs.name)}
                  placement="top"
                >
                  <StyledDaoImg src={dao.daoMetadata.metadataArgs.avatar} />
                </AppTooltip>
              </StyledLink>
            );
          }
          return null;
        })}
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

const StyledUserDaos = styled(Box)({
  flex: 1,
  gap: 20,
  overflow: "auto",
  paddingRight: 20,
  justifyContent: "flex-start",
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
});
