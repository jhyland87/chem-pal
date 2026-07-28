import { i18n } from '@/helpers/i18n';
import type { ReviewNotice } from '@/hooks/useReviewPrompt';
import { PromptSnackbar } from './PromptSnackbar';

/**
 * Props for {@link ReviewPrompt}.
 * - `notice` - The usage milestone to celebrate, or `undefined` to render nothing.
 * - `onReview` - Invoked when the user chooses to leave a review.
 * - `onDismiss` - Invoked when the user dismisses the prompt.
 */
interface ReviewPromptProps {
  notice: ReviewNotice | undefined;
  onReview: () => void;
  onDismiss: () => void;
}

/**
 * Invites an engaged user to leave a Chrome Web Store review.
 *
 * Reuses the shared {@link PromptSnackbar} — the same bottom-center notice as the
 * update prompts — summarizing how long they've had the extension and how much
 * they've used it, with an action that opens the store's reviews page.
 * @component
 * @category Components
 * @param props - The prompt props (see {@link ReviewPromptProps}).
 * @returns The rendered review prompt, or nothing when there's no milestone to show.
 * @example
 * ```tsx
 * const { notice, onReview, onDismiss } = useReviewPrompt();
 * <ReviewPrompt notice={notice} onReview={onReview} onDismiss={onDismiss} />
 * ```
 * @source
 */
export function ReviewPrompt({ notice, onReview, onDismiss }: ReviewPromptProps) {
  if (!notice) return null;

  return (
    <PromptSnackbar
      testId="review-snackbar"
      actionTestId="review-snackbar-action"
      dismissTestId="review-snackbar-dismiss"
      open
      message={i18n('review_prompt_message', [
        String(notice.days),
        String(notice.searches),
        String(notice.products),
      ])}
      actionLabel={i18n('review_prompt_action')}
      onAction={onReview}
      onDismiss={onDismiss}
      dismissLabel={i18n('update_dismiss')}
    />
  );
}
