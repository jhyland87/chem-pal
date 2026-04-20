import contributors from "@/../contributors.json";
import { default as Link } from "@/components/TabLink";
import GitHubIcon from "@/icons/GitHubIcon";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Modal from "@mui/material/Modal";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import styles from "./AboutModal.module.scss";
import {
  AboutContributorItem,
  AboutModalBox,
} from "./StyledComponents";

interface Contributor {
  name: string;
  github: string;
  testId: string;
}

/**
 * AboutModal component that displays information about the application.
 * Shows the application title, description, and contributor information in a modal dialog.
 *
 * The contributor list is loaded from `contributors.json` at the repo root;
 * entries render in the order they appear in that file. Static layout styles
 * (positioning, text alignment, contributor font size) live in the sibling
 * `AboutModal.module.scss`. Theme-dependent styles (palette, spacing, radius,
 * shadow, typography scale) live in the `AboutModalBox` / `AboutContributorItem`
 * styled components in `StyledComponents.ts`.
 * @component
 * @category Components
 * @param props - Component props.
 * @param props.aboutOpen - Whether the modal is open.
 * @param props.setAboutOpen - Setter to close the modal.
 * @example
 * ```tsx
 * <AboutModal aboutOpen={isOpen} setAboutOpen={setIsOpen} />
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
  const entries = contributors as Contributor[];

  return (
    <Modal
      data-testid="about-modal"
      onClick={() => setAboutOpen(false)}
      open={aboutOpen}
      onClose={() => setAboutOpen(false)}
      aria-labelledby="application-title"
      aria-describedby="application-description"
    >
      <AboutModalBox className={styles["about-box"]}>
        <Typography
          id="application-title"
          variant="h6"
          component="h2"
          className={styles["about-title"]}
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
        <Divider sx={{ color: "primary.main", my: 2 }}>
          <Typography variant="overline" gutterBottom sx={{ display: "block" }}>
            Contributors
          </Typography>
        </Divider>

        <Stack
          direction="row"
          useFlexGap
          className={styles["about-contributor-stack"]}
          sx={{ gap: 2 }}
        >
          {entries.map((entry) => (
            <AboutContributorItem key={entry.testId}>
              <Link data-testid={entry.testId} href={entry.github}>
                <Typography
                  sx={{ color: "text.secondary" }}
                  className={styles["about-contributor-link"]}
                >
                  {entry.name}
                </Typography>
              </Link>
            </AboutContributorItem>
          ))}
        </Stack>
      </AboutModalBox>
    </Modal>
  );
}
