import { useAppParams, useRole } from "hooks/hooks";
import { useDaoPageTranslations } from "i18n/hooks/useDaoPageTranslations";
import { useDaoQuery } from "query/getters";
import { Navigate } from "react-router-dom";
import { appNavigation } from "router/navigation";
import { LayoutSection } from "../components";
import { MetadataForm } from "./Metadata";
import { RolesForm } from "./Roles";
import { SetFwdMsgFee } from "./SetFwdMsgFee";

export function DaoSettings() {
  const translations = useDaoPageTranslations();
  const { daoAddress } = useAppParams();

  const { isLoading, data } = useDaoQuery(daoAddress);

  const { isOwner } = useRole(data?.daoRoles);

  if (!isLoading && !isOwner) {
    return <Navigate to={appNavigation.daoPage.root(daoAddress)} replace />;
  }

  return (
    <LayoutSection title={translations.settings} isLoading={isLoading}>
      <>
        <SetFwdMsgFee />
        <RolesForm />
        <MetadataForm />
      </>
    </LayoutSection>
  );
}

export default DaoSettings;
