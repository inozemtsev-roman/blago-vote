import { useDaoMetadataInputs, useDaoRolesInputs } from "forms/dao-form";
import {
  DaoMetadataForm,
  DaoRolesForm,
  FormArgs,
  FormikInputEndAdorment,
} from "types";

export const useMetadataForm = (): FormArgs<DaoMetadataForm> => {
  const inputs = useDaoMetadataInputs();

  return {
    title: "Метаданные",
    subTitle: "",
    inputs: [
      ...inputs,
      {
        label: "Скрыть ДАО",
        name: "hide",
        type: "checkbox",
      },
    ],
  };
};

export const useRolesForm = (
  EndAdornment: FormikInputEndAdorment<DaoRolesForm>
): FormArgs<DaoRolesForm> => {
  const inputs = useDaoRolesInputs(EndAdornment);
  return {
    title: "Роли",
    subTitle: "",
    inputs,
  };
};
