import {
  FormControl,
  MenuItem,
  Select,
  SelectChangeEvent,
  styled,
  Typography,
} from "@mui/material";
import { InputHeader, TextInput } from "components";
import { FormikProps } from "formik";
import { useMemo } from "react";
import { StyledFlexColumn, StyledFlexRow } from "styles";
import { ProposalForm } from "types";
import {
  CATEGORIES,
  getTemplateById,
  generateFromTemplate,
  TEMPLATES,
} from "data/taxonomy/proposal-templates";
import { TitleContainer } from "components/TitleContainer";

interface Props {
  formik: FormikProps<ProposalForm>;
}

export function TemplateSection({ formik }: Props) {
  const { templateId, templateParams = {}, isManual } = formik.values;
  const selectedTemplate = templateId ? getTemplateById(templateId) : null;

  const filteredTemplates = useMemo(() => {
    const cat = selectedTemplate?.category;
    if (!cat) return TEMPLATES;
    return TEMPLATES.filter((t: { category: string }) => t.category === cat);
  }, [selectedTemplate]);

  const onCategoryChange = (category: string) => {
    const firstInCategory = TEMPLATES.find(
      (t: { category: string }) => t.category === category
    );
    formik.setFieldValue("templateId", firstInCategory?.id || "");
    formik.setFieldValue("templateParams", {});
    formik.setFieldValue("title_en", "");
    formik.setFieldValue("description_en", "");
  };

  const onTemplateChange = (id: string) => {
    formik.setFieldValue("templateId", id);
    formik.setFieldValue("templateParams", {});
    formik.setFieldValue("title_en", "");
    formik.setFieldValue("description_en", "");
  };

  const onParamChange = (name: string, value: string) => {
    const newParams = { ...templateParams, [name]: value };
    formik.setFieldValue("templateParams", newParams);

    if (selectedTemplate) {
      const { title, description } = generateFromTemplate(
        selectedTemplate,
        newParams
      );
      formik.setFieldValue("title_en", title);
      formik.setFieldValue("description_en", description);
    }
  };

  const toggleManual = () => {
    formik.setFieldValue("isManual", !isManual);
    if (!isManual) {
      formik.setFieldValue("templateId", "");
      formik.setFieldValue("templateParams", {});
    }
  };

  if (isManual) {
    return (
      <StyledContainer>
        <StyledManualToggle onClick={toggleManual}>
          Использовать шаблон →
        </StyledManualToggle>
      </StyledContainer>
    );
  }

  return (
    <TitleContainer title="Тип предложения">
      <StyledContent gap={20}>
        <StyledFlexColumn alignItems="flex-start" gap={15}>
          <StyledField>
            <InputHeader title="Категория" required />
            <FormControl fullWidth>
              <Select
                value={selectedTemplate?.category || ""}
                onChange={(e: SelectChangeEvent) =>
                  onCategoryChange(e.target.value)
                }
                displayEmpty
                renderValue={(value: string) =>
                  value || "Выберите категорию"
                }
              >
                {CATEGORIES.map((cat: string) => (
                  <MenuItem key={cat} value={cat}>
                    {cat}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </StyledField>

          {selectedTemplate && (
            <StyledField>
              <InputHeader title="Тип заявки" required />
              <FormControl fullWidth>
                <Select
                  value={selectedTemplate?.id || ""}
                  onChange={(e: SelectChangeEvent) =>
                    onTemplateChange(e.target.value)
                  }
                >
                  {filteredTemplates.map(
                    (t: { id: string; type: string }) => (
                      <MenuItem key={t.id} value={t.id}>
                        {t.type}
                      </MenuItem>
                    )
                  )}
                </Select>
              </FormControl>
            </StyledField>
          )}

          {selectedTemplate && (
            <>
              <StyledTagsRow justifyContent="flex-start" gap={5}>
                {selectedTemplate.tags.map((tag: string) => (
                  <StyledTag key={tag}>#{tag}</StyledTag>
                ))}
              </StyledTagsRow>

              <StyledFlexColumn alignItems="flex-start" gap={15}>
                {selectedTemplate.parameters.map(
                  (param: {
                    name: string;
                    label: string;
                    required?: boolean;
                    placeholder?: string;
                    type: string;
                    options?: string[];
                  }) => {
                    const value = templateParams[param.name] || "";
                    const errorText =
                      param.required && !value
                        ? `Поле «${param.label}» обязательно`
                        : undefined;

                    if (param.type === "select") {
                      return (
                        <StyledField key={param.name}>
                          <InputHeader
                            title={param.label}
                            required={param.required}
                          />
                          <FormControl fullWidth>
                            <Select
                              value={value}
                              onChange={(e: SelectChangeEvent) =>
                                onParamChange(param.name, e.target.value)
                              }
                              displayEmpty
                              renderValue={(v: string) =>
                                v || param.placeholder || "Выберите..."
                              }
                            >
                              {param.options?.map((opt: string) => (
                                <MenuItem key={opt} value={opt}>
                                  {opt}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                          {errorText && (
                            <StyledError>{errorText}</StyledError>
                          )}
                        </StyledField>
                      );
                    }

                    return (
                      <StyledField key={param.name}>
                        <TextInput
                          title={param.label}
                          value={value}
                          onChange={(v: string) =>
                            onParamChange(param.name, v)
                          }
                          placeholder={param.placeholder}
                          required={param.required}
                          rows={param.type === "textarea" ? 4 : undefined}
                          error={errorText}
                        />
                      </StyledField>
                    );
                  }
                )}
              </StyledFlexColumn>

              {formik.values.title_en && (
                <PreviewBox>
                  <Typography
                    style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}
                  >
                    {formik.values.title_en}
                  </Typography>
                  <Typography
                    style={{
                      fontSize: 14,
                      whiteSpace: "pre-wrap",
                      opacity: 0.8,
                    }}
                  >
                    {formik.values.description_en}
                  </Typography>
                </PreviewBox>
              )}
            </>
          )}
        </StyledFlexColumn>

        <StyledManualToggle onClick={toggleManual}>
          Или ввести вручную →
        </StyledManualToggle>
      </StyledContent>
    </TitleContainer>
  );
}

const StyledContainer = styled(StyledFlexColumn)({
  alignItems: "flex-start",
  gap: 15,
});

const StyledContent = styled(StyledFlexColumn)({
  alignItems: "flex-start",
});

const StyledField = styled(StyledFlexColumn)({
  alignItems: "flex-start",
  gap: 0,
  width: "100%",
  maxWidth: 600,
});

const StyledTag = styled(Typography)(({ theme }) => ({
  fontSize: 12,
  fontWeight: 500,
  padding: "2px 8px",
  borderRadius: 12,
  background:
    theme.palette.mode === "light"
      ? "rgba(0, 152, 234, 0.1)"
      : "rgba(0, 152, 234, 0.2)",
  color: theme.palette.primary.main,
}));

const StyledTagsRow = styled(StyledFlexRow)({
  flexWrap: "wrap",
});

const StyledManualToggle = styled(Typography)(({ theme }) => ({
  cursor: "pointer",
  fontSize: 14,
  color: theme.palette.primary.main,
  fontWeight: 600,
  "&:hover": {
    textDecoration: "underline",
  },
}));

const StyledError = styled(Typography)({
  fontSize: 12,
  color: "#d32f2f",
  marginTop: 4,
});

const PreviewBox = styled("div")(({ theme }) => ({
  width: "100%",
  padding: 16,
  borderRadius: 10,
  background:
    theme.palette.mode === "light"
      ? "rgba(0,0,0,0.02)"
      : "rgba(255,255,255,0.05)",
  border:
    theme.palette.mode === "light"
      ? "1px solid #e0e0e0"
      : "1px solid rgba(255,255,255,0.1)",
}));
