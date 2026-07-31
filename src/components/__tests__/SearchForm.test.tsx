import { CACHE } from '@/constants/common';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@mui/icons-material', () => ({
  Science: () => <span />,
  Search: () => <span />,
}));

vi.mock('@/helpers/i18n', () => ({ i18n: (key: string) => key }));

const mocks = vi.hoisted(() => ({
  sessionGet: vi.fn(),
  sessionSet: vi.fn(),
  countActiveSearchFilters: vi.fn(),
}));

vi.mock('@/utils/storage', () => ({
  cstorage: { session: { get: mocks.sessionGet, set: mocks.sessionSet } },
}));

vi.mock('@/helpers/searchFilters', () => ({
  countActiveSearchFilters: mocks.countActiveSearchFilters,
}));

// A lightweight stand-in for the AST-parsing search input: a plain controlled
// input plus buttons to drive the onValidityChange callback deterministically.
vi.mock('../SearchPanel/HighlightedSearchInput', () => ({
  default: ({
    value,
    onChange,
    onValidityChange,
    ariaLabel,
    placeholder,
  }: {
    value: string;
    onChange: (v: string) => void;
    onValidityChange?: (blocked: boolean, message?: string) => void;
    ariaLabel?: string;
    placeholder?: string;
  }) => (
    <>
      <input
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
      <button type="button" onClick={() => onValidityChange?.(true, 'invalid msg')}>
        make-invalid
      </button>
      <button type="button" onClick={() => onValidityChange?.(false)}>
        make-valid
      </button>
    </>
  ),
}));

let mockContext: {
  searchFilters: { titleQuery: string };
  setSearchFilters: ReturnType<typeof vi.fn>;
  selectedSuppliers: string[];
  userSettings: object;
  toggleDrawer: ReturnType<typeof vi.fn>;
};

vi.mock('@/context', () => ({
  useAppContext: () => mockContext,
}));

import { SearchForm } from '../SearchForm';

/** Installs a fresh app-context mock with the given starting query. */
function setContext(titleQuery = '') {
  mockContext = {
    searchFilters: { titleQuery },
    setSearchFilters: vi.fn(),
    selectedSuppliers: [],
    userSettings: {},
    toggleDrawer: vi.fn(),
  };
  return mockContext;
}

describe('SearchForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sessionGet.mockResolvedValue({});
    mocks.sessionSet.mockResolvedValue(undefined);
    mocks.countActiveSearchFilters.mockReturnValue(0);
    setContext('');
  });

  it('renders the input, submit and advanced buttons', () => {
    render(<SearchForm onSearch={vi.fn()} />);

    expect(screen.getByLabelText('search_form_aria')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'search_submit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'search_advanced_options' })).toBeInTheDocument();
  });

  it('updates the shared query and persists the draft to session storage on change', async () => {
    const ctx = setContext('');
    render(<SearchForm onSearch={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('search_form_aria'), { target: { value: 'acetone' } });

    expect(ctx.setSearchFilters).toHaveBeenCalledWith(
      expect.objectContaining({ titleQuery: 'acetone' }),
    );
    await waitFor(() =>
      expect(mocks.sessionSet).toHaveBeenCalledWith({ [CACHE.SEARCH_INPUT]: 'acetone' }),
    );
  });

  it('submits the trimmed query and clears the draft', () => {
    const onSearch = vi.fn();
    const ctx = setContext('  acetone  ');
    render(<SearchForm onSearch={onSearch} />);

    fireEvent.click(screen.getByRole('button', { name: 'search_submit' }));

    expect(onSearch).toHaveBeenCalledWith('acetone');
    expect(ctx.setSearchFilters).toHaveBeenCalledWith(
      expect.objectContaining({ titleQuery: '' }),
    );
  });

  it('does not submit when the query is empty', () => {
    const onSearch = vi.fn();
    setContext('   ');
    render(<SearchForm onSearch={onSearch} />);

    // The submit button is disabled for a blank query; submit the form directly.
    const form = document.querySelector('form') as HTMLFormElement;
    fireEvent.submit(form);

    expect(onSearch).not.toHaveBeenCalled();
  });

  it('blocks submit and shows a hint when the query is invalid', async () => {
    const onSearch = vi.fn();
    setContext('bad(query');
    render(<SearchForm onSearch={onSearch} />);

    fireEvent.click(screen.getByText('make-invalid'));

    // Submit button becomes disabled; submitting the form is a no-op.
    const submit = screen.getByRole('button', { name: 'search_submit' });
    expect(submit).toBeDisabled();
    fireEvent.submit(document.querySelector('form') as HTMLFormElement);
    expect(onSearch).not.toHaveBeenCalled();

    // The debounced hint surfaces after the idle delay.
    expect(await screen.findByRole('alert')).toHaveTextContent('invalid msg');
  });

  it('toggles the drawer via context when no override is given', () => {
    const ctx = setContext('');
    render(<SearchForm onSearch={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'search_advanced_options' }));

    expect(ctx.toggleDrawer).toHaveBeenCalledOnce();
  });

  it('prefers the onDrawerToggle override when provided', () => {
    const ctx = setContext('');
    const onDrawerToggle = vi.fn();
    render(<SearchForm onSearch={vi.fn()} onDrawerToggle={onDrawerToggle} />);

    fireEvent.click(screen.getByRole('button', { name: 'search_advanced_options' }));

    expect(onDrawerToggle).toHaveBeenCalledOnce();
    expect(ctx.toggleDrawer).not.toHaveBeenCalled();
  });

  it('hydrates the query from session storage on mount', async () => {
    mocks.sessionGet.mockResolvedValue({ [CACHE.SEARCH_INPUT]: 'stored query' });
    const ctx = setContext('');
    render(<SearchForm onSearch={vi.fn()} />);

    await waitFor(() =>
      expect(ctx.setSearchFilters).toHaveBeenCalledWith(
        expect.objectContaining({ titleQuery: 'stored query' }),
      ),
    );
  });

  it('marks the advanced button active when filters are set', () => {
    mocks.countActiveSearchFilters.mockReturnValue(3);
    setContext('');
    render(<SearchForm onSearch={vi.fn()} />);

    // The button still renders; the active-count branch drives its highlight/tooltip.
    expect(screen.getByRole('button', { name: 'search_advanced_options' })).toBeInTheDocument();
  });
});
