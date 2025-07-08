import { useAppContext } from "@/context";
import TextField from "@mui/material/TextField";
import { ChangeEvent } from "react";
import { StyledFormControlSelector } from "../../Styles";

/**
 * SupplierResultLimit component that provides a text input for setting the result limit per supplier.
 * It allows users to specify how many results to display per supplier.
 *
 * @component
 *
 * @example
 * ```tsx
 * <SupplierResultLimit />
 * ```
 */
export default function SupplierResultLimit() {
  const appContext = useAppContext();

  /**
   * Handles changes to the result limit input.
   * Updates the user settings with the new result limit value.
   *
   * @param event - The change event
   */
  const handleResultLimitChange = (event: ChangeEvent<HTMLInputElement>) => {
    const {
      target: { value },
    } = event;
    appContext.setUserSettings({
      ...appContext.userSettings,
      supplierResultLimit: Number(value),
    });
  };

  return (
    <StyledFormControlSelector>
      <TextField
        label="Result Limit (per supplier)"
        style={{ lineHeight: "1em" }}
        id="result-limit"
        size="small"
        value={appContext.userSettings.supplierResultLimit ?? 5}
        onChange={handleResultLimitChange}
      />
    </StyledFormControlSelector>
  );
}
