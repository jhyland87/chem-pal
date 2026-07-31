import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import TabPanel from '../TabPanel';

describe('TabPanel', () => {
  it('renders children when value matches index', () => {
    render(
      <TabPanel value={1} index={1}>
        <span>Panel content</span>
      </TabPanel>,
    );

    expect(screen.getByText('Panel content')).toBeInTheDocument();
  });

  it('hides and omits children when value does not match index', () => {
    render(
      <TabPanel value={0} index={1}>
        <span>Panel content</span>
      </TabPanel>,
    );

    expect(screen.queryByText('Panel content')).not.toBeInTheDocument();
    expect(screen.getByRole('tabpanel', { hidden: true })).toHaveAttribute('hidden');
  });

  it('sets the tabpanel accessibility attributes from index', () => {
    render(
      <TabPanel value={2} index={2}>
        content
      </TabPanel>,
    );

    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveAttribute('id', 'full-width-tabpanel-2');
    expect(panel).toHaveAttribute('aria-labelledby', 'full-width-tab-2');
    expect(panel).not.toHaveAttribute('hidden');
  });

  it('forwards additional props to the container element', () => {
    render(
      <TabPanel value={0} index={0} data-testid="my-panel" dir="rtl">
        content
      </TabPanel>,
    );

    const panel = screen.getByTestId('my-panel');
    expect(panel).toHaveAttribute('dir', 'rtl');
  });

  it('supports string values for value/index equality', () => {
    render(
      <TabPanel value={'a'} index={'a' as unknown as number}>
        <span>String panel</span>
      </TabPanel>,
    );

    expect(screen.getByText('String panel')).toBeInTheDocument();
  });
});
