import { ReviewPrompt } from '@/components/ReviewPrompt';
import type { ReviewNotice } from '@/hooks/useReviewPrompt';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const NOTICE: ReviewNotice = { days: 15, searches: 6, products: 42 };

describe('ReviewPrompt', () => {
  it('renders nothing when there is no milestone', () => {
    render(<ReviewPrompt notice={undefined} onReview={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.queryByTestId('review-snackbar')).not.toBeInTheDocument();
  });

  it('summarizes the usage milestone', () => {
    render(<ReviewPrompt notice={NOTICE} onReview={vi.fn()} onDismiss={vi.fn()} />);
    const snackbar = screen.getByTestId('review-snackbar');
    expect(snackbar).toHaveTextContent('15');
    expect(snackbar).toHaveTextContent('6');
    expect(snackbar).toHaveTextContent('42');
  });

  it('fires onReview when the action is clicked', () => {
    const onReview = vi.fn();
    render(<ReviewPrompt notice={NOTICE} onReview={onReview} onDismiss={vi.fn()} />);

    fireEvent.click(screen.getByTestId('review-snackbar-action'));

    expect(onReview).toHaveBeenCalledTimes(1);
  });

  it('fires onDismiss when dismissed', () => {
    const onDismiss = vi.fn();
    render(<ReviewPrompt notice={NOTICE} onReview={vi.fn()} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByTestId('review-snackbar-dismiss'));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
