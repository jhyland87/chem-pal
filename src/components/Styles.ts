/* eslint-disable @typescript-eslint/naming-convention */
import MuiAccordion from "@mui/material/Accordion";
import MuiAccordionDetails from "@mui/material/AccordionDetails";
import MuiAccordionSummary from "@mui/material/AccordionSummary";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import FormControl, { FormControlProps } from "@mui/material/FormControl";
import Input from "@mui/material/Input";
import InputAdornment from "@mui/material/InputAdornment";
import Paper from "@mui/material/Paper";
import { styled } from "@mui/material/styles";

// Navigation Styled Components
export const StyledAppBar = styled(AppBar)(() => ({
  borderRadius: 0,
  position: "relative",
  backgroundColor: "#ffffff",
  color: "#000000",
  boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.2) !important",
  borderBottom: "1px solid rgba(0, 0, 0, 0.12)",
  zIndex: 10,
}));

export const StyledAppBarPaper = styled(Paper)(() => ({
  borderRadius: 0,
  position: "relative",
  backgroundColor: "#ffffff",
  boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.2) !important",
  borderBottom: "1px solid rgba(0, 0, 0, 0.12)",
}));

export const StyledFormControlSelector = styled(FormControl)<FormControlProps>(({ theme }) => ({
  color: theme.palette.primary.dark,
  fontSize: 14,
  padding: 0,
  margin: 0,
  m: 0,
  width: "100%",
  lineHeight: "1em",
  //transform: "translate(14px, 10px) scale(1)",
  "& .MuiInputBase-root": {
    maxHeight: "36.13px",
    color: "#ffffff",
  },
  "& .MuiInputBase-input": {
    color: "#ffffff",
    "&::placeholder": {
      color: "#ffffff",
      opacity: 0.7,
    },
  },
  "& .MuiInputLabel-root": {
    fontSize: 14,
    maxHeight: "36.13px",
    transform: "translate(14px, 10px) scale(1)",
    color: "#ffffff",
  },

  "& .MuiInputBase-inputSizeSmall": {
    //padding: [7, 14],
    padding: "2px 0 0 0",
    fontSize: 14,
  },
  "& .MuiInputLabel-root.MuiInputLabel-shrink, & .MuiInputLabel-root.Mui-focused, &  .MuiInputLabel-root.MuiFormLabel-filled":
    {
      transform: "translate(13.5px, -8px) scale(0.75)",
      fontSize: 17,
      color: "#ffffff",
    },
  "& .MuiInputLabel-root:not(.MuiInputLabel-shrink), & .MuiInputLabel-root:not(.Mui-focused), & .MuiInputLabel-root:not(.MuiFormLabel-filled":
    {
      //transform: "translate(14px, 12px) scale(1)",
      transform: "translate(14px, 10px) scale(1)",
      fontSize: 14,
      color: "#ffffff",
      //marginTop: "-7px",
    },
  "& .MuiOutlinedInput-notchedOutline": {
    borderColor: "rgba(255, 255, 255, 0.5)",
  },
  "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": {
    borderColor: "#ffffff",
  },
  "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {
    borderColor: "#ffffff",
  },
}));

// FilterMenu Styled Components
export const FilterMenuDrawerTriggers = styled(Box)(() => ({
  position: "fixed",
  right: 0,
  top: "20%",
  zIndex: 1500,
  display: "flex",
  flexDirection: "column",
}));

export const FilterMenuDrawerTrigger = styled(Box)(() => ({
  backgroundColor: "rgba(255, 255, 255, 0.9)",
  color: "#333333",
  padding: "8px",
  marginBottom: "2px",
  cursor: "pointer",
  borderTopLeftRadius: "6px",
  borderBottomLeftRadius: "6px",
  border: "1px solid rgba(0, 0, 0, 0.08)",
  borderRight: "none",
  minHeight: "44px",
  minWidth: "36px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "background-color 0.2s ease",
  "& svg": {
    fontSize: "1.1rem",
    color: "inherit",
    transition: "none",
  },
  "&:hover": {
    backgroundColor: "rgba(255, 255, 255, 1)",
  },
  "&.active": {
    backgroundColor: "rgba(200, 200, 200, 0.95)",
    color: "#222222",
  },
}));

export const FilterMenuDrawer = styled(Drawer)(() => ({
  zIndex: 1600,
  "& .MuiDrawer-paper": {
    width: 220,
    backgroundColor: "rgba(30, 30, 30, 0.95)",
    backdropFilter: "blur(8px)",
    borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
    margin: 0,
    padding: 0,
    right: 0,
    top: 0,
    position: "fixed",
    zIndex: 1600,
  },
  "& .MuiBackdrop-root": {
    backgroundColor: "transparent",
  },
  "& .MuiModal-root": {
    position: "fixed",
    right: 0,
    zIndex: 1600,
  },
}));

export const FilterMenuDrawerContent = styled(Box)(() => ({
  width: "100%",
  padding: "0px",
  height: "100%",
  display: "flex",
  flexDirection: "column",
}));

export const FilterMenuTabContent = styled(Box)(() => ({
  flex: 1,
  overflow: "auto",
  padding: "8px 0",
}));

export const FilterMenuAccordion = styled(MuiAccordion)(({ theme }) => ({
  border: `1px solid ${theme.palette.divider}`,
  "&:not(:last-child)": {
    borderBottom: 0,
  },
  "&::before": {
    display: "none",
  },
}));

export const FilterMenuAccordionSummary = styled(MuiAccordionSummary)(({ theme }) => ({
  display: "flex",
  minHeight: "28px",
  maxHeight: "48px",
  overflowY: "scroll",
  minWidth: "40px",
  backgroundColor: "rgba(0, 0, 0, .03)",
  color: "#ffffff",
  flexDirection: "row-reverse",
  "&:hover": {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderBottom: "1px solid rgba(255, 255, 255, 0.3)",
  },
  "&.Mui-expanded": {
    minHeight: "28px",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  "& .MuiAccordionSummary-expandIconWrapper": {
    color: "#ffffff",
    "&.Mui-expanded": {
      transform: "rotate(90deg)",
    },
  },
  "& .MuiAccordionSummary-content": {
    margin: "1px 0px 1px 0px",
    marginLeft: theme.spacing(1),
    color: "#ffffff",
  },

  ...theme.applyStyles("dark", {
    backgroundColor: "rgba(255, 255, 255, .05)",
    "&:hover": {
      backgroundColor: "rgba(255, 255, 255, 0.12)",
    },
  }),
}));

export const FilterMenuAccordionDetails = styled(MuiAccordionDetails)(() => ({
  color: "#ffffff",
  padding: 0,
  borderTop: "1px solid rgba(0, 0, 0, .125)",
  "& .MuiInputBase-input": {
    color: "#ffffff",
    "&::placeholder": {
      color: "#ffffff",
      opacity: 0.7,
    },
  },
  "& .MuiInputLabel-root": {
    color: "#ffffff",
  },
  "& .MuiOutlinedInput-notchedOutline": {
    borderColor: "rgba(255, 255, 255, 0.5)",
  },
  "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": {
    borderColor: "#ffffff",
  },
  "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {
    borderColor: "#ffffff",
  },
  "& .MuiCheckbox-root": {
    color: "#ffffff",
    "&.Mui-checked": {
      color: "#ffffff",
    },
    "&:hover": {
      backgroundColor: "rgba(255, 255, 255, 0.08)",
    },
  },
  "& .MuiListItemText-primary": {
    color: "#ffffff",
  },
}));

// Styled ListItemIcon for consistent checkbox styling across filter components
export const FilterListItemIcon = styled("div")(() => ({
  padding: 0,
  minWidth: 20,
  maxWidth: 25,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
}));

// Styled Input for the filter search in FilterMenu
export const FilterMenuInput = styled(Input)(() => ({
  color: "#ffffff",
  "& .MuiInputBase-input": {
    padding: "0px",
    color: "#ffffff",
    "&::placeholder": {
      color: "#ffffff",
      opacity: 0.7,
    },
  },
  "& .MuiInput-underline:before": {
    borderBottomColor: "rgba(255, 255, 255, 0.5)",
  },
  "& .MuiInput-underline:hover:before": {
    borderBottomColor: "#ffffff",
  },
  "& .MuiInput-underline:after": {
    borderBottomColor: "#ffffff",
  },
}));

// Styled InputAdornment for the filter search icon
export const FilterMenuInputAdornment = styled(InputAdornment)(() => ({
  padding: 0,
  color: "#ffffff",
}));

//MuiFormLabel-root MuiInputLabel-root MuiInputLabel-formControl MuiInputLabel-animated MuiInputLabel-outlined MuiFormLabel-colorPrimary MuiInputLabel-root MuiInputLabel-formControl MuiInputLabel-animated MuiInputLabel-outlined css-enqxln-MuiFormLabel-root-MuiInputLabel-root
