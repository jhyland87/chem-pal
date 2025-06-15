/* eslint-disable @typescript-eslint/naming-convention */
import MuiAccordion from "@mui/material/Accordion";
import MuiAccordionDetails from "@mui/material/AccordionDetails";
import MuiAccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import FormControl, { FormControlProps } from "@mui/material/FormControl";
import { styled } from "@mui/material/styles";
import Tabs from "@mui/material/Tabs";

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
  },
  "& .MuiInputLabel-root": {
    fontSize: 14,
    maxHeight: "36.13px",
    transform: "translate(14px, 10px) scale(1)",
  },

  "& .MuiInputBase-inputSizeSmall": {
    //padding: [7, 14],
    fontSize: 14,
  },
  "& .MuiInputLabel-root.MuiInputLabel-shrink, & .MuiInputLabel-root.Mui-focused, &  .MuiInputLabel-root.MuiFormLabel-filled":
    {
      transform: "translate(13.5px, -8px) scale(0.75)",
      fontSize: 17,
    },
  "& .MuiInputLabel-root:not(.MuiInputLabel-shrink), & .MuiInputLabel-root:not(.Mui-focused), & .MuiInputLabel-root:not(.MuiFormLabel-filled":
    {
      //transform: "translate(14px, 12px) scale(1)",
      transform: "translate(14px, 10px) scale(1)",
      fontSize: 14,
      //marginTop: "-7px",
    },
}));

// FilterMenu Styled Components
export const FilterMenuBorder = styled(Box)(({ theme }) => ({
  position: "fixed",
  right: 0,
  top: 0,
  bottom: 0,
  width: "33px",
  backgroundColor: theme.palette.background.paper,
  borderLeft: "1px solid #e0e0e0",
  zIndex: 1400,
}));

export const FilterMenuTabsContainer = styled(Box)(({ theme }) => ({
  position: "fixed",
  right: 0,
  top: "17%",
  transform: "translateY(-20%)",
  zIndex: 1500,
  backgroundColor: theme.palette.background.paper,
  borderTop: "1px solid #e0e0e0",
  borderBottom: "1px solid #e0e0e0",
}));

export const FilterMenuTabs = styled(Tabs)(({ theme }) => ({
  minWidth: "32px",
  width: "32px",
  backgroundColor: theme.palette.background.paper,
  "& .MuiTab-root": {
    minWidth: "33px",
    minHeight: "60px",
    padding: "8px 4px",
    writingMode: "vertical-rl",
    textOrientation: "upright",
    fontSize: "0.75rem",
    backgroundColor: theme.palette.background.paper,
    borderBottom: "1px solid #e0e0e0",
    "&:last-child": {
      borderBottom: "none",
    },
    "&.Mui-selected": {
      backgroundColor: theme.palette.action.selected,
    },
  },
}));

export const FilterMenuDrawer = styled(Drawer)(() => ({
  "& .MuiDrawer-paper": {
    marginRight: "33px",
  },
}));

export const FilterMenuDrawerContent = styled(Box)(() => ({
  width: 300,
  padding: "0px",
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
  flexDirection: "row-reverse",
  "& .MuiAccordionSummary-expandIconWrapper.Mui-expanded": {
    transform: "rotate(90deg)",
  },
  "& .MuiAccordionSummary-content": {
    margin: "1px 0px 1px 0px",
    marginLeft: theme.spacing(1),
  },
  ...theme.applyStyles("dark", {
    backgroundColor: "rgba(255, 255, 255, .05)",
  }),
}));

export const FilterMenuAccordionDetails = styled(MuiAccordionDetails)(() => ({
  padding: 0,
  borderTop: "1px solid rgba(0, 0, 0, .125)",
}));

//MuiFormLabel-root MuiInputLabel-root MuiInputLabel-formControl MuiInputLabel-animated MuiInputLabel-outlined MuiFormLabel-colorPrimary MuiInputLabel-root MuiInputLabel-formControl MuiInputLabel-animated MuiInputLabel-outlined css-enqxln-MuiFormLabel-root-MuiInputLabel-root
