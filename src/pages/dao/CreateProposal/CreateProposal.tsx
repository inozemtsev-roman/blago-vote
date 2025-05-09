import { useAppParams } from "hooks/hooks";
import { useCreateProposalStore } from "./store";
import _ from "lodash";
import { useAppNavigation } from "router/navigation";
import { useCreateProposalQuery } from "query/setters";
import { useNewDataStore } from "store";
import { LayoutSection } from "../components";
import { ProposalForm } from "forms/proposal-form/ProposalForm";
import { ProposalForm as ProposalFormType, ProposalHidePopupVariant } from "types";
import { prepareMetadata } from "forms/proposal-form/utils";
import { useDaoQuery } from "query/getters";


export const CreateProposal = () => {
  const { daoAddress } = useAppParams();

  const { data: dao, isLoading: daoLoading } = useDaoQuery(daoAddress);
  const { setFormData, formData } = useCreateProposalStore();
  const appNavigation = useAppNavigation();
  const { mutate: createProposal, isLoading } = useCreateProposalQuery();
  const { addProposal } = useNewDataStore();

  const onSubmit = (formValues: ProposalFormType) => {
    const metadata = prepareMetadata(formValues);
    console.log("Creating proposal with metadata:", metadata);
    
    createProposal({
      metadata,
      onSuccess: (proposalAddress: string) => {
        console.log("Proposal created successfully:", proposalAddress);
        console.log("Adding proposal to local storage for DAO:", dao!.daoAddress);
        appNavigation.proposalPage.root(dao!.daoAddress, proposalAddress);
        setFormData({} as ProposalFormType);
        addProposal(dao!.daoAddress, proposalAddress);
      },
    });
  };

  return (
    <LayoutSection title="Создать предложение" isLoading={daoLoading}>
      
      <ProposalForm
        submitText="Создать"
        initialFormData={formData}
        persistForm={setFormData}
        onSubmit={onSubmit}
        isLoading={isLoading}
        dao={dao!}
      />
    </LayoutSection>
  );
};

export default CreateProposal;
