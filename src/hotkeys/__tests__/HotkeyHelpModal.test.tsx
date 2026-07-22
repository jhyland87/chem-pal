import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HotkeyHelpModal from '../HotkeyHelpModal';
import { getHotkeyConfigs } from '../useHotkeys';

describe('HotkeyHelpModal', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    onClose.mockClear();
  });

  it('does not render content when closed', () => {
    render(<HotkeyHelpModal open={false} onClose={onClose} />);
    expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument();
  });

  it('renders the title and grouped tabs when open', () => {
    render(<HotkeyHelpModal open={true} onClose={onClose} />);

    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();

    // Every distinct group in config.json should appear as a tab.
    const groups = new Set(getHotkeyConfigs().map((c) => c.group || 'General'));
    for (const group of groups) {
      expect(screen.getAllByRole('tab', { name: group }).length).toBeGreaterThan(0);
    }
  });

  it("shows the descriptions for the first group's entries", () => {
    const configs = getHotkeyConfigs();
    const firstGroup = configs[0].group || 'General';
    const firstGroupEntries = configs.filter(
      (c) => (c.group || 'General') === firstGroup && !c.unlisted,
    );

    render(<HotkeyHelpModal open={true} onClose={onClose} />);

    for (const entry of firstGroupEntries) {
      expect(screen.getByText(entry.description)).toBeInTheDocument();
    }
  });

  it('switches the visible entries when a different tab is selected', () => {
    const configs = getHotkeyConfigs();
    const groups = Array.from(new Set(configs.map((c) => c.group || 'General')));
    // Need at least two groups to exercise the tab switch.
    expect(groups.length).toBeGreaterThan(1);

    const otherGroup = groups[1];
    const otherEntry = configs.find((c) => (c.group || 'General') === otherGroup)!;

    render(<HotkeyHelpModal open={true} onClose={onClose} />);

    // Initially the second group's entry is not shown.
    expect(screen.queryByText(otherEntry.description)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: otherGroup }));

    expect(screen.getByText(otherEntry.description)).toBeInTheDocument();
  });

  it('renders formatted key combo chips for entries', () => {
    render(<HotkeyHelpModal open={true} onClose={onClose} />);

    // shift+? in the General group -> chips "⇧" and "?" (non-mac would be "Shift"/"?").
    const modal = screen.getByTestId('hotkey-help-modal');
    // The "?" key label is always present regardless of platform.
    expect(within(modal).getByText('?')).toBeInTheDocument();
  });

  it('calls onClose when the backdrop is clicked', () => {
    render(<HotkeyHelpModal open={true} onClose={onClose} />);

    const backdrop = document.querySelector('.MuiBackdrop-root');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);

    expect(onClose).toHaveBeenCalled();
  });

  it('does not call onClose when clicking inside the modal body', () => {
    render(<HotkeyHelpModal open={true} onClose={onClose} />);

    fireEvent.click(screen.getByText('Keyboard Shortcuts'));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('surfaces matches from non-active groups when searching', async () => {
    render(<HotkeyHelpModal open={true} onClose={onClose} />);

    // A Results-group entry is hidden on the default (first) tab.
    expect(
      screen.queryByText('Focus the global filter on the results panel'),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/search shortcuts/i), {
      target: { value: 'global filter' },
    });

    // The search is debounced; findBy polls until it appears.
    expect(
      await screen.findByText('Focus the global filter on the results panel'),
    ).toBeInTheDocument();
    // A non-matching entry is not shown while filtering.
    expect(screen.queryByText('Go to the search panel')).not.toBeInTheDocument();
  });

  it('never renders an unlisted hotkey, even when searching', async () => {
    const unlisted = getHotkeyConfigs().filter((c) => c.unlisted);
    // Guard: this test is only meaningful if an unlisted hotkey exists.
    expect(unlisted.length).toBeGreaterThan(0);
    const hidden = unlisted[0];

    render(<HotkeyHelpModal open={true} onClose={onClose} />);

    expect(screen.queryByText(hidden.description)).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/search shortcuts/i), {
      target: { value: hidden.description },
    });

    expect(await screen.findByText('No matching shortcuts')).toBeInTheDocument();
    expect(screen.queryByText(hidden.description)).not.toBeInTheDocument();
  });

  it('shows a no-matches message when nothing matches', async () => {
    render(<HotkeyHelpModal open={true} onClose={onClose} />);

    fireEvent.change(screen.getByPlaceholderText(/search shortcuts/i), {
      target: { value: 'zzz-nothing-matches' },
    });

    expect(await screen.findByText('No matching shortcuts')).toBeInTheDocument();
  });

  it('clears the search when reopened', () => {
    const { rerender } = render(<HotkeyHelpModal open={true} onClose={onClose} />);

    const input = screen.getByPlaceholderText(/search shortcuts/i);
    fireEvent.change(input, { target: { value: 'expand' } });
    expect(input).toHaveValue('expand');

    rerender(<HotkeyHelpModal open={false} onClose={onClose} />);
    rerender(<HotkeyHelpModal open={true} onClose={onClose} />);

    expect(screen.getByPlaceholderText(/search shortcuts/i)).toHaveValue('');
  });

  it('resets to the first tab each time it reopens', () => {
    const configs = getHotkeyConfigs();
    const groups = Array.from(new Set(configs.map((c) => c.group || 'General')));
    const firstGroup = groups[0];
    const secondGroup = groups[1];
    const firstEntry = configs.find((c) => (c.group || 'General') === firstGroup)!;

    const { rerender } = render(<HotkeyHelpModal open={true} onClose={onClose} />);

    // Move to the second tab.
    fireEvent.click(screen.getByRole('tab', { name: secondGroup }));

    // Close and reopen.
    rerender(<HotkeyHelpModal open={false} onClose={onClose} />);
    rerender(<HotkeyHelpModal open={true} onClose={onClose} />);

    // Back on the first group's entries.
    expect(screen.getByText(firstEntry.description)).toBeInTheDocument();
  });
});
