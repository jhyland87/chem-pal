import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/helpers/i18n', () => ({
  i18n: (key: string, subs?: string[]) => (subs?.length ? `${key}:${subs.join(',')}` : key),
}));

import { MigrationPrompt } from '../MigrationPrompt';

const steps = [
  { from: '1', to: '2', description: 'reshape price cache' },
  { from: '2', to: '3', description: 'add supplier index' },
] as unknown as import('@/migrations/types').Migration[];

/** Builds MigrationPrompt props with overridable defaults. */
function makeProps(overrides = {}) {
  return {
    open: true,
    steps,
    onApply: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
}

describe('MigrationPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when closed', () => {
    render(<MigrationPrompt {...makeProps({ open: false })} />);

    expect(screen.queryByText('migration_title')).not.toBeInTheDocument();
  });

  it('shows the title, body and one line per migration step', () => {
    render(<MigrationPrompt {...makeProps()} />);

    expect(screen.getByText('migration_title')).toBeInTheDocument();
    expect(screen.getByText('migration_body')).toBeInTheDocument();
    expect(screen.getByText('migration_step:1,2,reshape price cache')).toBeInTheDocument();
    expect(screen.getByText('migration_step:2,3,add supplier index')).toBeInTheDocument();
  });

  it('shows an error alert when the error prop is set', () => {
    render(<MigrationPrompt {...makeProps({ error: 'apply failed' })} />);

    expect(screen.getByText('apply failed')).toBeInTheDocument();
  });

  it('calls onApply and onCancel when the buttons are clicked', () => {
    const onApply = vi.fn();
    const onCancel = vi.fn();
    render(<MigrationPrompt {...makeProps({ onApply, onCancel })} />);

    fireEvent.click(screen.getByTestId('migration-apply'));
    fireEvent.click(screen.getByTestId('migration-cancel'));

    expect(onApply).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('disables both buttons while busy', () => {
    render(<MigrationPrompt {...makeProps({ busy: true })} />);

    expect(screen.getByTestId('migration-apply')).toBeDisabled();
    expect(screen.getByTestId('migration-cancel')).toBeDisabled();
  });
});
