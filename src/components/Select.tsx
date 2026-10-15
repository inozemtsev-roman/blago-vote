import {
  Box,
  MenuItem,
  Select as MuiSelect,
  SelectChangeEvent,
  styled,
  useTheme,
} from "@mui/material";
import { SelectOption } from "types";
import {MdKeyboardArrowDown} from 'react-icons/md'
import { StyledSelectContainer } from "styles";
interface Props {
  options: SelectOption[];
  selected: string;
  onSelect: (value: string) => void;
  className?: string;
}

export function Select({ options, selected, onSelect, className = '' }: Props) {
  const handleChange = (event: SelectChangeEvent) => {
    onSelect(event.target.value);
  };


  const theme = useTheme()

  return (
    <StyledSelectContainer className={className}>
      <MuiSelect
        MenuProps={{
          PaperProps: {
            style: {
              borderRadius: 10,
              border: theme.palette.mode === 'light' ?  "1px solid rgba(19, 19, 20, 0.16)" : '1px solid rgba(229, 229, 234, 0.2)',
              boxShadow: theme.palette.mode === 'light' ? "rgb(114 138 150 / 8%) 0px 2px 16px" : 'unset',
            },
          },
        }}
        IconComponent={MdKeyboardArrowDown}
        value={selected}
        onChange={handleChange}
      >
        {options.map((option) => {
          return (
            <MenuItem key={option.value} value={option.value}>
              {option.text}
            </MenuItem>
          );
        })}
      </MuiSelect>
    </StyledSelectContainer>
  );
}



