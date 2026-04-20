import { default as Link } from "@/components/TabLink";
import GitHubIcon from "@/icons/GitHubIcon";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Modal from "@mui/material/Modal";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { styled, type Theme } from "@mui/material/styles";

/**
 * Styled Paper component for contributor items.
 * Provides consistent styling for contributor links with theme-aware colors and spacing.
 * @param props - Component props
 * @source
 */
const Item = styled(Paper)(({ theme }: { theme: Theme }) => ({
  ...theme.typography.body2,
  padding: theme.spacing(1),
  textAlign: "center",
  color: theme.palette.text.secondary,
  flexGrow: 1,
}));

/**
 * AboutModal component that displays information about the application.
 * Shows the application title, description, and contributor information in a modal dialog.
 * @component
 * @category Components
 * @param props - Component props
 * @example
 * ```tsx
 * <AboutModal
 *   aboutOpen={isOpen}
 *   setAboutOpen={setIsOpen}
 * />
 * ```
 * @source
 */
export default function AboutModal({
  aboutOpen,
  setAboutOpen,
}: {
  aboutOpen: boolean;
  setAboutOpen: (open: boolean) => void;
}) {
  return (
    <Modal
      data-testid="about-modal"
      onClick={() => setAboutOpen(false)}
      open={aboutOpen}
      onClose={() => setAboutOpen(false)}
      aria-labelledby="application-title"
      aria-describedby="application-description"
    >
      <Box
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(500px, 90vw)",
          maxHeight: "85vh",
          overflowY: "auto",
          bgcolor: "background.paper",
          color: "text.primary",
          borderRadius: 2,
          boxShadow: 24,
          p: 4,
          outline: "none",
        }}
      >
        <Typography
          id="application-title"
          variant="h6"
          component="h2"
          sx={{ textAlign: "center" }}
        >
          About ChemPal
          <IconButton
            data-testid="github-button"
            href="https://github.com/justinhyland/chem-pal"
            target="_blank"
            rel="noopener noreferrer"
            sx={{ ml: 1.25 }}
          >
            <GitHubIcon />
          </IconButton>
        </Typography>
        <Typography
          id="application-description"
          variant="subtitle2"
          gutterBottom
          sx={{ mt: 0.5, display: "block" }}
        >
          Open source project aimed at helping amateur chemistry hobbyists find the best deals on
          chemical reagents. There are plenty of similar services out there for businesses,
          universities and research institutions, but none are available for individuals and
          hobbyists. ChemPal only searches suppliers that sell to individuals and ship to
          residences.
        </Typography>
        <Divider sx={{ color: "secondary.light", my: 2 }}>
          <Typography variant="overline" gutterBottom sx={{ display: "block", fontSize: "0.8rem" }}>
            Contributors
          </Typography>
        </Divider>

        <Stack direction="row" useFlexGap sx={{ flexWrap: "wrap", gap: 2 }}>
          <Item>
            <Link data-testid="contributor-justin" href="https://github.com/jhyland87">
              <Typography sx={{ color: "text.secondary", fontSize: "0.8rem", textAlign: "center" }}>
                Justin Hyland
              </Typography>
            </Link>
          </Item>
          <Item>
            <Link data-testid="contributor-maui" href="https://github.com/YourHeatingMantle">
              <Typography sx={{ color: "text.secondary", fontSize: "0.8rem", textAlign: "center" }}>
                Maui3
              </Typography>
            </Link>
          </Item>
          <Item>
            <Link data-testid="contributor-spous" href="https://github.com/spous">
              <Typography sx={{ color: "text.secondary", fontSize: "0.8rem", textAlign: "center" }}>
                Spous
              </Typography>
            </Link>
          </Item>
        </Stack>
      </Box>
    </Modal>
  );
}
