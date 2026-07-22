import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let isDevBuild = false;
vi.mock('@/utils/isDevBuild', () => ({
  get IS_DEV_BUILD() {
    return isDevBuild;
  },
}));

let advancedMode = false;
vi.mock('@/context', () => ({
  useAppContext: () => ({ advancedMode }),
}));

import { StatusBadges } from '../StatusBadges';

describe('StatusBadges', () => {
  beforeEach(() => {
    isDevBuild = false;
    advancedMode = false;
  });

  it('renders nothing when neither applies', () => {
    const { container } = render(<StatusBadges />);
    expect(container.firstChild).toBeNull();
  });

  it('shows only the dev badge in a plain dev build', () => {
    isDevBuild = true;
    render(<StatusBadges />);
    expect(screen.getByText('DEV BUILD')).toBeTruthy();
    expect(screen.queryByText('ADVANCED MODE')).toBeNull();
  });

  it('shows only the advanced badge in a prod build', () => {
    advancedMode = true;
    render(<StatusBadges />);
    expect(screen.getByText('ADVANCED MODE')).toBeTruthy();
    expect(screen.queryByText('DEV BUILD')).toBeNull();
  });

  // The bug this component exists to fix: the two badges were separately
  // position:fixed at the same corner and rendered on top of each other.
  it('renders both as siblings in one tray so they lay out side by side', () => {
    isDevBuild = true;
    advancedMode = true;
    render(<StatusBadges />);

    const dev = screen.getByText('DEV BUILD');
    const advanced = screen.getByText('ADVANCED MODE');
    expect(dev.parentElement).toBe(advanced.parentElement);
    expect(dev.parentElement?.childElementCount).toBe(2);
    // Neither badge positions itself; only the tray is fixed.
    for (const badge of [dev, advanced]) {
      expect(badge.style.position).not.toBe('fixed');
    }
  });
});
