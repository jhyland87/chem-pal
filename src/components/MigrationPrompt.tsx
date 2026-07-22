import { i18n } from '@/helpers/i18n';
import type { Migration } from '@/migrations/types';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Modal from '@mui/material/Modal';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import styles from './MigrationPrompt.module.scss';
import { AboutModalBox } from './StyledComponents';

/**
 * Props for {@link MigrationPrompt}.
 * - `open` - Whether the modal is shown.
 * - `steps` - The pending migration steps to list.
 * - `busy` - Disables both buttons while an action is in flight.
 * - `error` - Optional error message shown when applying failed.
 * - `onApply` - Invoked when the user chooses to apply the updates.
 * - `onCancel` - Invoked when the user chooses to clear the cache and start fresh.
 */
interface MigrationPromptProps {
  open: boolean;
  steps: Migration[];
  busy?: boolean;
  error?: string;
  onApply: () => void;
  onCancel: () => void;
}

/**
 * Startup modal shown when the cached data was written by an older app version.
 * Lists each pending migration (`from → to: description`) and offers two choices:
 * **Apply Updates** (run the migrations in place) or **Cancel** (clear the cache
 * and start fresh). It is intentionally non-dismissable — there is no backdrop
 * close — because the app defers loading cached data until the user decides.
 * @component
 * @category Components
 * @param props - The prompt props (see {@link MigrationPromptProps}).
 * @returns The rendered migration prompt modal.
 * @example
 * ```tsx
 * <MigrationPrompt
 *   open={pending.length > 0}
 *   steps={pending}
 *   onApply={handleApply}
 *   onCancel={handleCancel}
 * />
 * ```
 * @source
 */
export function MigrationPrompt({
  open,
  steps,
  busy = false,
  error,
  onApply,
  onCancel,
}: MigrationPromptProps) {
  return (
    <Modal
      data-testid="migration-modal"
      open={open}
      aria-labelledby="migration-title"
      aria-describedby="migration-body"
    >
      <AboutModalBox className={styles['migration-box']}>
        <Typography
          id="migration-title"
          variant="h6"
          component="h2"
          className={styles['migration-title']}
          gutterBottom
        >
          {i18n('migration_title')}
        </Typography>
        <Typography id="migration-body" variant="body2" gutterBottom>
          {i18n('migration_body')}
        </Typography>

        <Stack className={styles['migration-steps']} spacing={0.5}>
          {steps.map((step) => (
            <Typography key={`${step.from}-${step.to}`} variant="caption" color="text.secondary">
              {i18n('migration_step', [step.from, step.to, step.description])}
            </Typography>
          ))}
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {error}
          </Alert>
        )}

        <Stack
          direction="row"
          spacing={1}
          justifyContent="flex-end"
          className={styles['migration-actions']}
        >
          <Button data-testid="migration-cancel" onClick={onCancel} disabled={busy} color="inherit">
            {i18n('migration_cancel')}
          </Button>
          <Button
            data-testid="migration-apply"
            onClick={onApply}
            disabled={busy}
            variant="contained"
          >
            {i18n('migration_apply')}
          </Button>
        </Stack>
      </AboutModalBox>
    </Modal>
  );
}
