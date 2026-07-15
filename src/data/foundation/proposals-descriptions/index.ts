import { THE_OPEN_LEAGUE_DESCRIPTION } from "./the-open-league";

const HARDCODED: Record<string, string> = {
  EQA5eyWDAAegbL5Ay1CfelGG3yY9Ow7bgpfocTV6KDt9zeIl: THE_OPEN_LEAGUE_DESCRIPTION,
};

export const getProposalDescription = (
  address: string,
  decription?: string
) => {
  return HARDCODED[address as keyof typeof HARDCODED] || decription;
};
