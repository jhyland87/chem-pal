import { i18n } from '@/helpers/i18n';
import type { UpdateNotice } from '@/hooks/useUpdateAvailable';
import { useState } from 'react';
import { PromptSnackbar } from './PromptSnackbar';
import { WhatsNewModal } from './WhatsNewModal';

/**
 * Props for {@link UpdatePrompt}.
 * - `notice` - The pending update, or `undefined` to render nothing.
 * - `onDismiss` - Invoked when the user dismisses the prompt for good (✕).
 * - `onSnooze` - Invoked when the user defers the prompt (modal "Later").
 * - `onApply` - Invoked when the user takes the call to action.
 */
interface UpdatePromptProps {
  notice: UpdateNotice | undefined;
  onDismiss: () => void;
  onSnooze: () => void;
  onApply: () => void;
}

/**
 * Snackbar shown when a newer version of the extension is available.
 *
 * When the release has notes, the action opens {@link WhatsNewModal} and the
 * modal carries the real call to action — the popup is too short to list
 * highlights inline. Without notes there's nothing to expand, so the action
 * applies the update directly: **Reload now** for Web Store installs (the update
 * is already downloaded and waiting) or **View release** for manual installs
 * (the user has to download it themselves).
 *
 * Three levels of "not now", deliberately distinct:
 * - **modal open** — the snackbar hides, so one update is never announced twice;
 * - **"Later"** — a snooze, persisted per version by `useUpdateAvailable`, so
 *   the update stays gone across refreshes and prompts again once it expires;
 * - **✕ on the snackbar** — a real dismissal, persisted per version, so that
 *   version never prompts again.
 *
 * It has no auto-hide timeout — a popup can be open for a second or two, so a
 * timed dismissal would routinely never be seen. It closes only on an explicit
 * action, and `useUpdateAvailable` remembers the snooze/dismissal per version.
 * @component
 * @category Components
 * @param props - The prompt props (see {@link UpdatePromptProps}).
 * @returns The rendered update snackbar, or nothing when there's no update.
 * @example
 * ```tsx
 * const { notice, dismiss, applyUpdate } = useUpdateAvailable();
 * <UpdatePrompt notice={notice} onDismiss={dismiss} onApply={applyUpdate} />
 * ```
 * @source
 */
export function UpdatePrompt({ notice, onDismiss, onSnooze, onApply }: UpdatePromptProps) {
  const [notesOpen, setNotesOpen] = useState(false);

  if (!notice) return null;

  // With notes to show, the snackbar defers to the modal, which carries the
  // real call to action. Without them there's nothing to expand, so the
  // snackbar acts directly.
  const hasNotes = notice.notes.length > 0;
  const actionLabel = hasNotes
    ? i18n('update_whats_new')
    : notice.source === 'webstore'
      ? i18n('update_action_reload')
      : i18n('update_action_view');

  const handleAction = () => {
    if (hasNotes) {
      setNotesOpen(true);
      return;
    }
    onApply();
  };

  return (
    <>
      <PromptSnackbar
        testId="update-snackbar"
        actionTestId="update-apply"
        dismissTestId="update-dismiss"
        // Hidden while the modal is up (never two notices for one update).
        // Closing via "Later" or ✕ clears `notice`, unmounting the whole prompt.
        open={!notesOpen}
        message={i18n('update_available_message', [notice.version])}
        actionLabel={actionLabel}
        onAction={handleAction}
        onDismiss={onDismiss}
        dismissLabel={i18n('update_dismiss')}
      />
      <WhatsNewModal
        notice={notice}
        open={notesOpen}
        onClose={() => {
          setNotesOpen(false);
          onSnooze();
        }}
        onApply={onApply}
      />
    </>
  );
}
