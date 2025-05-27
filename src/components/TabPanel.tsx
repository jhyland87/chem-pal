import { type TabPanelProps } from "@/types/props";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

/**
 * TabPanel component that renders content for a specific tab.
 * The content is only visible when the tab is selected.
 *
 * @component
 * @category Components
 * @param props - Component props
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
