import { default as Link } from "@/components/TabLink";
import { i18n } from "@/helpers/i18n";
import { getAvailableUpdate } from "@/helpers/updates";
import GitHubIcon from "@/icons/GitHubIcon";
import { ThemeContext } from "@/themes";
import ArticleIcon from "@mui/icons-material/Article";
import BrowserUpdatedIcon from "@mui/icons-material/BrowserUpdated";
import BugReportIcon from "@mui/icons-material/BugReport";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PrivacyTipIcon from "@mui/icons-material/PrivacyTip";
import SignalWifiConnectedNoInternet4Icon from "@mui/icons-material/SignalWifiConnectedNoInternet4";
import WebIcon from "@mui/icons-material/Web";
import Divider from "@mui/material/Divider";
import Modal from "@mui/material/Modal";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useContext, useState } from "react";
import styles from "./AboutModal.module.scss";
import {
  AboutContributorItem,
  AboutModalBox,
  AboutModalLink,
  AboutModalLinkContainer,
} from "./StyledComponents";

/**
 * AboutModal component that displays information about the application.
 * Shows the application title, description, and contributor information in a modal dialog.
 *
 * The contributor list is loaded from `src/data/contributors.json`;
 * entries render in the order they appear in that file. Static layout styles
 * (positioning, text alignment, contributor font size) live in the sibling
 * `AboutModal.module.scss`. Theme-dependent styles (palette, spacing, radius,
 * shadow, typography scale) live in the `AboutModalBox` / `AboutContributorItem`
 * styled components in `StyledComponents.ts`.
 * @component
 * @category Components
 * @param props - Component props.
 * - `aboutOpen` - Whether the modal is open.
 * - `setAboutOpen` - Setter to close the modal.
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
  // Trusted static build-time JSON whose shape matches Contributor.
  const entries = __APP_CONTRIBUTORS__;
  const themeContext = useContext(ThemeContext);
  const [updateIcon, setUpdateIcon] = useState<React.ReactNode>(
    <BrowserUpdatedIcon sx={{ fontSize: 16 }} />,
  );
  const logoSrc =
    themeContext?.mode === "dark"
      ? "/static/images/logo/ChemPal-logo-inverted.svg"
      : "/static/images/logo/ChemPal-logo.svg";

  const handleCheckForUpdates = () => {
    void (async () => {
      try {
        const update = await getAvailableUpdate();
        setUpdateIcon(
          update ? (
            <BrowserUpdatedIcon sx={{ fontSize: 16, color: "warning.main" }} />
          ) : (
            <CheckCircleIcon sx={{ fontSize: 16, color: "success.main" }} />
          ),
        );
      } catch (error) {
        console.error("Failed to check for updates:", { error });
        setUpdateIcon(
          <SignalWifiConnectedNoInternet4Icon sx={{ fontSize: 16, color: "error.main" }} />,
        );
      }
    })();
  };
  return (
    <Modal
      data-testid="about-modal"
      open={aboutOpen}
      onClose={() => setAboutOpen(false)}
      aria-labelledby="application-title"
      aria-describedby="application-description"
    >
      <AboutModalBox className={styles["about-box"]} onClick={(e) => e.stopPropagation()}>
        <img src={logoSrc} alt={i18n("about_logo_alt")} className={styles["about-logo"]} />
        <Typography
          id="application-title"
          variant="h6"
          component="h2"
          className={styles["about-title"]}
        >
          {i18n("about_title")}
        </Typography>
        <Typography
          variant="subtitle2"
          gutterBottom
          sx={{ alignItems: "center", textAlign: "center" }}
        >
          {__APP_VERSION__}{" "}
          <Link
            href="#"
            onClick={handleCheckForUpdates}
            sx={{ marginLeft: 1, verticalAlign: "top" }}
          >
            {updateIcon}
          </Link>
        </Typography>

        <AboutModalLinkContainer>
          <AboutModalLink
            data-testid="github-button"
            href={__APP_REPOSITORY__}
            target="_blank"
            rel="noopener noreferrer"
          >
            <GitHubIcon />
          </AboutModalLink>
          <AboutModalLink
            data-testid="homepage-button"
            href={__APP_HOMEPAGE__}
            target="_blank"
            rel="noopener noreferrer"
          >
            <WebIcon />
          </AboutModalLink>
          <AboutModalLink
            data-testid="wiki-button"
            href={__APP_WIKI__}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ArticleIcon />
          </AboutModalLink>
          <AboutModalLink
            data-testid="privacy-button"
            href={__APP_PRIVACY__}
            target="_blank"
            rel="noopener noreferrer"
          >
            <PrivacyTipIcon />
          </AboutModalLink>
          <AboutModalLink
            data-testid="bugs-button"
            href={__APP_BUGS__}
            target="_blank"
            rel="noopener noreferrer"
          >
            <BugReportIcon />
          </AboutModalLink>
        </AboutModalLinkContainer>
        <Typography
          id="application-description"
          variant="subtitle2"
          gutterBottom
          sx={{ mt: 0.5, display: "block" }}
        >
          {i18n("about_description")}
        </Typography>
        <Divider sx={{ color: "primary.main", my: 2 }}>
          <Typography variant="overline" gutterBottom sx={{ display: "block" }}>
            {i18n("about_contributors")}
          </Typography>
        </Divider>

        <Stack
          direction="row"
          useFlexGap
          className={styles["about-contributor-stack"]}
          sx={{ gap: 2 }}
        >
          {entries.map((entry) => (
            <AboutContributorItem key={entry.name}>
              <Link data-testid={entry.name} href={entry.url}>
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
