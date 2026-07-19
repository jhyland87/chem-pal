import { i18n } from "@/helpers/i18n";
import type { UpdateNotice } from "@/hooks/useUpdateAvailable";
import Button from "@mui/material/Button";
import Modal from "@mui/material/Modal";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { AboutModalBox } from "./StyledComponents";
import styles from "./WhatsNewModal.module.scss";

/**
 * Props for {@link WhatsNewModal}.
 * - `notice` - The pending update whose notes are shown; `undefined` renders nothing.
 * - `open` - Whether the modal is visible.
 * - `onClose` - Invoked when the user closes without applying.
 * - `onApply` - Invoked when the user takes the call to action.
 */
interface WhatsNewModalProps {
  notice: UpdateNotice | undefined;
  open: boolean;
  onClose: () => void;
  onApply: () => void;
}

/**
 * Lists the release-note highlights for a pending update, grouped by the
 * headings from the release body (Added / Changed / Fixed …), with the call to
 * action for the user's install type. Opened from the update snackbar, which
 * stays compact because the popup has very little vertical room.
 *
 * The notes come from the GitHub release body, which the release workflow fills
 * from `CHANGELOG.md`. When they're unavailable — offline, rate-limited, or a
 * release published without a body — the modal says so rather than showing an
 * empty list, and the action still works.
 * @component
 * @category Components
 * @param props - The modal props (see {@link WhatsNewModalProps}).
 * @returns The rendered what's-new modal.
 * @example
 * ```tsx
 * <WhatsNewModal notice={notice} open={open} onClose={close} onApply={applyUpdate} />
 * ```
 * @source
 */
export function WhatsNewModal({ notice, open, onClose, onApply }: WhatsNewModalProps) {
  if (!notice) return null;

  const actionLabel =
    notice.source === "webstore" ? i18n("update_action_reload") : i18n("update_action_view");

  return (
    <Modal
      data-testid="whats-new-modal"
      open={open}
      onClose={onClose}
      aria-labelledby="whats-new-title"
    >
      <AboutModalBox className={styles["whats-new-box"]}>
        <Typography id="whats-new-title" variant="h6" component="h2" align="center" gutterBottom>
          {i18n("update_modal_title", [notice.version])}
        </Typography>

        {notice.notes.length === 0 ? (
          <Typography variant="body2" color="text.secondary" data-testid="whats-new-empty">
            {i18n("update_notes_unavailable")}
          </Typography>
        ) : (
          <Stack className={styles["whats-new-sections"]} spacing={1.5}>
            {notice.notes.map((section, sectionIndex) => (
              <div key={section.title ?? `section-${sectionIndex}`}>
                {section.title && (
                  <Typography variant="overline" color="text.secondary" component="h3">
                    {section.title}
                  </Typography>
                )}
                <ul className={styles["whats-new-list"]}>
                  {section.items.map((item) => (
                    <Typography key={item} variant="body2" component="li">
                      {item}
                    </Typography>
                  ))}
                </ul>
              </div>
            ))}
          </Stack>
        )}

        <Stack
          direction="row"
          spacing={1}
          justifyContent="flex-end"
          className={styles["whats-new-actions"]}
        >
          <Button data-testid="whats-new-close" onClick={onClose} color="inherit">
            {i18n("update_later")}
          </Button>
          <Button data-testid="whats-new-apply" onClick={onApply} variant="contained">
            {actionLabel}
          </Button>
        </Stack>
      </AboutModalBox>
    </Modal>
  );
}
