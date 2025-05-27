import { useAppContext } from "@/context";
import TextField from "@mui/material/TextField";
import { ChangeEvent, useState } from "react";
import { StyledFormControlSelector } from "../../Styles";

/**
 * TextColumnFilter component that provides a text input filter for columns.
 * It allows users to filter data by entering text that matches column values.
 *
 * @component
 *
 * @param props - Component props
 *
 * @example
 * ```tsx
 * <TextColumnFilter column={column} />
 * ```
 */
export default function SupplierResultLimit() {
  const appContext = useAppContext();
  const [, setResultLimit] = useState<number>(appContext.settings.supplierResultLimit);

  /**
   * Handles changes to the text filter input.
   * Updates the local state and triggers the column filter update with debouncing.
   *
   * @param event - The change event
   */
  const handleResultLimitChange = (event: ChangeEvent<HTMLInputElement>) => {
    const {
      target: { value },
    } = event;
    setResultLimit(Number(value));
    appContext.setSettings({
      ...appContext.settings,
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
        value={appContext.settings.supplierResultLimit}
        onChange={handleResultLimitChange}
      />
    </StyledFormControlSelector>
  );
}
