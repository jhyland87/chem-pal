import { i18n } from '@/helpers/i18n';
import type { JustUpdatedNotice } from '@/hooks/useJustUpdated';
import { useState } from 'react';
import { PromptSnackbar } from './PromptSnackbar';
import { WhatsNewModal } from './WhatsNewModal';

/**
 * Props for {@link WhatsNewPrompt}.
 * - `notice` - The just-installed release, or `undefined` to render nothing.
 * - `onAcknowledge` - Invoked once the user has seen or dismissed the notes.
 */
interface WhatsNewPromptProps {
  notice: JustUpdatedNotice | undefined;
  onAcknowledge: () => void;
}

/**
 * Announces what changed after the extension updated itself.
 *
 * Mirrors `UpdatePrompt` — same snackbar, same modal — but for a release
 * that is already installed, so there's nothing to apply: the modal ends in a
 * single acknowledging button rather than a call to action, and either control
 * settles it. The notes ship inside the build (`__CHANGELOG_CURRENT__`), so this
 * works offline and shows exactly what was published for the release.
 * @component
 * @category Components
 * @param props - The prompt props (see {@link WhatsNewPromptProps}).
 * @returns The rendered post-update prompt, or nothing when there's nothing to announce.
 * @example
 * ```tsx
 * const { notice, acknowledge } = useJustUpdated();
 * <WhatsNewPrompt notice={notice} onAcknowledge={acknowledge} />
 * ```
 * @source
 */
export function WhatsNewPrompt({ notice, onAcknowledge }: WhatsNewPromptProps) {
  const [notesOpen, setNotesOpen] = useState(false);

  if (!notice) return null;

  return (
    <>
      <PromptSnackbar
        testId="whats-new-snackbar"
        actionTestId="whats-new-snackbar-apply"
        dismissTestId="whats-new-snackbar-dismiss"
        // Steps aside for the modal, exactly as the update prompt does.
        open={!notesOpen}
        message={i18n('update_installed_message', [notice.version])}
        actionLabel={i18n('update_whats_new')}
        onAction={() => setNotesOpen(true)}
        onDismiss={onAcknowledge}
        dismissLabel={i18n('update_dismiss')}
      />
      <WhatsNewModal
        notice={notice}
        open={notesOpen}
        onClose={() => {
          setNotesOpen(false);
          onAcknowledge();
        }}
      />
    </>
  );
}
