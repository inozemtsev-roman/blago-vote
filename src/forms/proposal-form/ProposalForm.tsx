import { Box, Fade, styled, Typography } from "@mui/material";
import { useTonAddress } from "@tonconnect/ui-react";
import {
  AppTooltip,
  Button,
  ConnectButton,
  FormikInputsForm,
} from "components";
import { FormikProps, useFormik } from "formik";
import { useDebouncedCallback } from "hooks/hooks";
import _ from "lodash";
import { mock } from "mock/mock";
import { useDaoStateQuery } from "query/getters";
import { useEffect, useState } from "react";
import { StyledFlexColumn, StyledFlexRow } from "styles";
import { errorToast } from "toasts";
import {
  Dao,
  ProposalForm as ProposalFormType,
  ProposalHidePopupVariant,
  ProposalInputArgs,
  ProposalStatus,
} from "types";
import { validateFormik } from "utils";
import { getTemplateById } from "data/taxonomy/proposal-templates";
import { useCreateProposalForm } from "./inputs";
import ProposalHidePopup from "./ProposalHidePopup";
import { StrategySelect } from "./StrategySelect";
import { TemplateSection } from "./TemplateSection";
import { getInitialValues } from "./utils";
import { useFormSchema } from "./validation";

export function ProposalForm({
  onSubmit,
  isLoading,
  initialFormData,
  persistForm,
  dao,
  editMode = false,
  submitText,
  status,
}: {
  onSubmit: (values: ProposalFormType) => void;
  isLoading: boolean;
  initialFormData: ProposalFormType;
  persistForm?: (values: ProposalFormType) => void;
  dao: Dao;
  editMode?: boolean;
  submitText: string;
  status?: ProposalStatus;
}) {
  const form = useCreateProposalForm(initialFormData, editMode, status);
  const daoState = useDaoStateQuery(dao.daoAddress).data;
  const FormSchema = useFormSchema();

  const formik = useFormik<ProposalFormType>({
    initialValues: getInitialValues(initialFormData, dao, editMode),
    validationSchema: FormSchema,
    onSubmit,
    validateOnChange: false,
    validateOnBlur: true,
  });
  const customInputHandler = useCustomInputHandler(formik);
  const [variant, setVariant] = useState<ProposalHidePopupVariant>();
  const saveForm = useDebouncedCallback(() => {
    persistForm?.(formik.values);
  });

  const showTemplateUI = !editMode && !formik.values.isManual;

  useEffect(() => {
    saveForm();
  }, [formik.values]);

  const onSubmitClick = async () => {
    if (showTemplateUI) {
      const template = getTemplateById(formik.values.templateId || "");
      if (template) {
        const params = formik.values.templateParams || {};
        const missingRequired = template.parameters.filter(
          (p) => p.required && !params[p.name]
        );
        if (missingRequired.length > 0) {
          errorToast(
            `Заполните обязательные поля: ${missingRequired
              .map((p) => p.label)
              .join(", ")}`
          );
          return;
        }
      }
    }

    const hide = formik.values.hide;
    const prevHide = initialFormData.hide;

    const errors = await formik.validateForm(formik.values);
    if (!_.isEmpty(errors)) {
      validateFormik(formik);
      return;
    }

    if (mock.isMockDao(dao.daoAddress)) {
      errorToast("This is a mock DAO. You cannot create/edit proposals.");
      return;
    }

    if (!editMode && hide) {
      setVariant("hide");
    } else if (editMode && hide && !prevHide) {
      setVariant("changed-to-hide");
    } else if (editMode && !hide && prevHide) {
      setVariant("changed-to-show");
    } else {
      formik.submitForm();
    }
  };

  const onPopupSubmit = () => {
    setVariant(undefined);
    formik.submitForm();
  };

  
  const disableButton = !editMode
    ? false
    : _.isEqual(formik.values, formik.initialValues);

  return (
    <Fade in={true}>
      <StyledContainer alignItems="flex-start">
        <StyledFormWrapper gap={15}>
          {showTemplateUI && <TemplateSection formik={formik} />}
          <FormikInputsForm<ProposalFormType>
            formik={formik}
            form={form}
            customInputHandler={customInputHandler}
          >
            <CreateProposalButton
              submitText={submitText}
              isLoading={isLoading || daoState?.fwdMsgFee === undefined}
              onSubmit={onSubmitClick}
              disabled={disableButton}
            />
          </FormikInputsForm>
        </StyledFormWrapper>
        <ProposalHidePopup
          variant={variant}
          onClose={() => setVariant(undefined)}
          open={!!variant}
          onSubmit={onPopupSubmit}
        />
      </StyledContainer>
    </Fade>
  );
}

const StyledContainer = styled(StyledFlexRow)({
  flex: 1,
  ".date-input": {
    ".MuiFormControl-root": {
      width: "100%",
    },
  },
});

const StyledFormWrapper = styled(StyledFlexColumn)({
  gap: 15,
  width: "100%",
});

function CreateProposalButton({
  onSubmit,
  isLoading,
  submitText,
  disabled
}: {
  onSubmit?: () => void;
  isLoading: boolean;
  submitText: string;
  disabled?: boolean;
}) {
  const address = useTonAddress();
  return (
    <AppTooltip text={disabled ? 'Вам нужно внести изменения, чтобы продолжить.' : ''}>
      <StyledSubmit>
        {!address ? (
          <StyledConnect />
        ) : (
          <StyledButton
            disabled={disabled}
            isLoading={isLoading}
            onClick={onSubmit}
          >
            {submitText}
          </StyledButton>
        )}
      </StyledSubmit>
    </AppTooltip>
  );
}

const StyledSubmit = styled(Box)({
  width: "100%",
  maxWidth: 400,
  marginLeft: "auto",
  marginRight: "auto",
  marginTop: 80,
});

const StyledConnect = styled(ConnectButton)({
  width: "100%",
});

const StyledButton = styled(Button)({
  width: "100%",
});

const useCustomInputHandler = (formik: FormikProps<ProposalFormType>) => {
  return (args: ProposalInputArgs) => {
    if (args.name === "_categorySelector") {
      return (
        <StyledCategoryToggle
          onClick={() => formik.setFieldValue("isManual", false)}
        >
          Выбрать категорию
        </StyledCategoryToggle>
      );
    }
    const value = formik.values.votingPowerStrategies;
    return (
      <StrategySelect
        required={args.required}
        tooltip={args.tooltip}
        selectedStrategies={value || []}
        label={args.label}
        formik={formik}
        name={args.name!}
      />
    );
  };
};

const StyledCategoryToggle = styled(Typography)(({ theme }) => ({
  cursor: "pointer",
  fontSize: 14,
  color: theme.palette.primary.main,
  fontWeight: 600,
  "&:hover": {
    textDecoration: "underline",
  },
}));
