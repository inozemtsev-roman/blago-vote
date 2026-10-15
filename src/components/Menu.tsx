import { Menu as MuiMenu, useTheme } from "@mui/material";
export function Menu({
  anchorEl,
  setAnchorEl,
  children,
}: {
  anchorEl: HTMLButtonElement | null;
  setAnchorEl: (value: HTMLButtonElement | null) => void;
  children: React.ReactNode;
}) {
  const theme = useTheme()
  const open = Boolean(anchorEl);

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <MuiMenu
      PaperProps={{
        style: {
          borderRadius: 10,
          border: theme.palette.mode === 'light' ?  "1px solid rgba(19, 19, 20, 0.16)" : '1px solid rgba(229, 229, 234, 0.2)',
          boxShadow: theme.palette.mode === 'light'  ? "rgb(114 138 150 / 8%) 0px 2px 16px" : 'unset',
        },
      }}
      id="basic-menu"
      anchorEl={anchorEl}
      open={open}
      onClose={handleClose}
      anchorOrigin={{
        vertical: "bottom",
        horizontal: "center",
      }}
      transformOrigin={{
        vertical: "top",
        horizontal: "center",
      }}
    >
      {children}
    </MuiMenu>
  );
}
