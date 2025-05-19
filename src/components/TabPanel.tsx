import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { TabPanelProps } from "types";

/**
 * TabPanel component that renders content for a specific tab.
 * The content is only visible when the tab is selected.
 *
 * @component
 * @category Component
 * @param {TabPanelProps} props - Component props
 * @param {ReactNode} [props.children] - Child elements to render
 * @param {string} [props.dir] - Text direction (ltr/rtl)
 * @param {number} props.index - Tab index
 * @param {number|string} props.value - Current value
 * @param {object} [props.style] - Additional styles
 * @param {string} props.name - Panel name
 *
 * @example
 * ```tsx
 * <TabPanel value={currentTab} index={0} name="first-panel">
 *   <div>First panel content</div>
 * </TabPanel>
 * ```
 */
export default function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`full-width-tabpanel-${index}`}
      aria-labelledby={`full-width-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 1 }}>
          <Typography component={"span"} variant={"body2"}>
            {children}
          </Typography>
        </Box>
      )}
    </div>
  );
}
