import { SliderProps } from "@mui/material";
import FormControl from "@mui/material/FormControl";
import { styled } from "@mui/material/styles";

export const StyledFormControlSelector = styled(FormControl)<SliderProps>(({ theme }) => ({
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

//MuiFormLabel-root MuiInputLabel-root MuiInputLabel-formControl MuiInputLabel-animated MuiInputLabel-outlined MuiFormLabel-colorPrimary MuiInputLabel-root MuiInputLabel-formControl MuiInputLabel-animated MuiInputLabel-outlined css-enqxln-MuiFormLabel-root-MuiInputLabel-root
