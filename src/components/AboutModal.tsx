import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Modal from "@mui/material/Modal";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { styled, type Theme } from "@mui/material/styles";
import GitHubIcon from "../assets/icons/GitHubIcon";
import "./AboutModal.scss";
import { default as Link } from "./TabLink";

/**
 * Styled Paper component for contributor items.
 * Provides consistent styling for contributor links with theme-aware colors and spacing.
 *
 * @param props - Component props
 */
const Item = styled(Paper)(({ theme }: { theme: Theme }) => ({
  backgroundColor: "#fff",
  ...theme.typography.body2,
  padding: theme.spacing(1),
  textAlign: "center",
  color: theme.palette.text.secondary,
  flexGrow: 1,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  "&.dark": {
    backgroundColor: "#1A2027",
  },
}));

/**
 * AboutModal component that displays information about the application.
 * Shows the application title, description, and contributor information in a modal dialog.
 *
 * @component
 * @category Component
 * @param props - Component props
 * @example
 * ```tsx
 * <AboutModal
 *   aboutOpen={isOpen}
 *   setAboutOpen={setIsOpen}
 * />
 * ```
 */
export default function AboutModal({
  aboutOpen,
  setAboutOpen,
}: {
  aboutOpen: boolean;
  setAboutOpen: (open: boolean) => void;
}) {
  return (
    <div>
      <Modal
        id="about-modal"
        onClick={() => setAboutOpen(false)}
        open={aboutOpen}
        onClose={() => setAboutOpen(false)}
        aria-labelledby="application-title"
        aria-describedby="application-description"
        aria-contributors="application-contributors"
      >
        <Box className="about-box">
          <Typography id="application-title" variant="h6" component="h2">
            About ChemPare
            <IconButton
              href="https://github.com/justinhyland/chem-crawler"
              target="_blank"
              rel="noopener noreferrer"
              className="github-button"
            >
              <GitHubIcon className="github-icon" />
            </IconButton>
          </Typography>
          <Typography id="application-description" variant="subtitle2" gutterBottom>
            Open source project aimed at helping amateur chemistry hobbyists find the best deals on
            chemical reagents. There are plenty of similar services out there for businesses,
            universities and research institutions, but none are available for individuals and
            hobbyists. ChemPare only searches suppliers that sell to individuals and ship to
            residences.
          </Typography>
          <Divider sx={{ color: "secondary.light" }}>
            <Typography variant="overline" gutterBottom sx={{ display: "block" }}>
              Contributors
            </Typography>
          </Divider>
          <Typography id="application-contributors" sx={{ color: "text.secondary" }}>
            <Stack direction="row" useFlexGap>
              <Item>
                <Link href="https://github.com/jhyland87">Justin Hyland</Link>
              </Item>
              <Item>
                <Link href="https://github.com/YourHeatingMantle">Maui3</Link>
              </Item>
              <Item>
                <Link href="https://github.com/spous">Spous</Link>
              </Item>
            </Stack>
          </Typography>
        </Box>
      </Modal>
    </div>
  );
}
