import { WhatsNewPrompt } from '@/components/WhatsNewPrompt';
import type { JustUpdatedNotice } from '@/hooks/useJustUpdated';
import { fireEvent, render, screen, waitForElementToBeRemoved } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const NOTICE: JustUpdatedNotice = {
  version: '1.3.0',
  previousVersion: '1.2.0',
  notes: [{ title: 'Added', items: ['Update prompt', "What's new modal"] }],
};

describe('WhatsNewPrompt', () => {
  it('renders nothing when there is nothing to announce', () => {
    render(<WhatsNewPrompt notice={undefined} onAcknowledge={vi.fn()} />);
    expect(screen.queryByTestId('whats-new-snackbar')).not.toBeInTheDocument();
  });

  it('announces the version that was just installed', () => {
    render(<WhatsNewPrompt notice={NOTICE} onAcknowledge={vi.fn()} />);
    expect(screen.getByTestId('whats-new-snackbar')).toHaveTextContent('1.3.0');
    expect(screen.getByTestId('whats-new-snackbar-apply')).toHaveTextContent("What's new");
  });

  it('opens the modal with the release notes', () => {
    render(<WhatsNewPrompt notice={NOTICE} onAcknowledge={vi.fn()} />);

    fireEvent.click(screen.getByTestId('whats-new-snackbar-apply'));

    expect(screen.getByTestId('whats-new-modal')).toBeInTheDocument();
    expect(screen.getByText('Update prompt')).toBeInTheDocument();
    expect(screen.getByText("What's new modal")).toBeInTheDocument();
  });

  // Nothing to apply for a release that's already running, so the modal ends in
  // a single acknowledging button rather than a call to action.
  it('offers no apply action for an already-installed release', () => {
    render(<WhatsNewPrompt notice={NOTICE} onAcknowledge={vi.fn()} />);
    fireEvent.click(screen.getByTestId('whats-new-snackbar-apply'));

    expect(screen.queryByTestId('whats-new-apply')).not.toBeInTheDocument();
    expect(screen.getByTestId('whats-new-close')).toHaveTextContent('Got it');
  });

  it('hides the snackbar while the modal is open', async () => {
    render(<WhatsNewPrompt notice={NOTICE} onAcknowledge={vi.fn()} />);
    fireEvent.click(screen.getByTestId('whats-new-snackbar-apply'));

    await waitForElementToBeRemoved(() => screen.queryByTestId('whats-new-snackbar'));
  });

  it('acknowledges once the notes are closed', () => {
    const onAcknowledge = vi.fn();
    render(<WhatsNewPrompt notice={NOTICE} onAcknowledge={onAcknowledge} />);
    fireEvent.click(screen.getByTestId('whats-new-snackbar-apply'));

    fireEvent.click(screen.getByTestId('whats-new-close'));

    expect(onAcknowledge).toHaveBeenCalledTimes(1);
  });

  // Dismissing without reading is still an acknowledgement — the release has
  // been announced, and repeating it on the next open would nag.
  it('acknowledges when dismissed from the snackbar', () => {
    const onAcknowledge = vi.fn();
    render(<WhatsNewPrompt notice={NOTICE} onAcknowledge={onAcknowledge} />);

    fireEvent.click(screen.getByTestId('whats-new-snackbar-dismiss'));

    expect(onAcknowledge).toHaveBeenCalledTimes(1);
  });
});
