import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import IconTextFader from '../IconTextFader';

describe('IconTextFader', () => {
  it('renders both the text and the icon child', () => {
    render(
      <IconTextFader text="Search" active={false}>
        <span data-testid="icon">icon</span>
      </IconTextFader>,
    );

    expect(screen.getByText('Search')).toBeInTheDocument();
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('shows the text collapse expanded when active', async () => {
    render(
      <IconTextFader text="Search" active={true}>
        <span>icon</span>
      </IconTextFader>,
    );

    // MUI Collapse marks the entered state with the MuiCollapse-entered class.
    const textCollapse = () => screen.getByText('Search').closest('.MuiCollapse-root');
    await waitFor(() => expect(textCollapse()).toHaveClass('MuiCollapse-entered'));
  });

  it('reveals the text on mouse enter and reverts to active state on leave', async () => {
    const { container } = render(
      <IconTextFader text="Search" active={false}>
        <span>icon</span>
      </IconTextFader>,
    );

    // The component's root div wraps both Collapse elements.
    const wrapper = container.firstChild as HTMLElement;
    const textCollapse = () => screen.getByText('Search').closest('.MuiCollapse-root');

    // Not active: text collapse starts collapsed.
    expect(textCollapse()).toHaveClass('MuiCollapse-hidden');

    fireEvent.mouseEnter(wrapper);
    await waitFor(() => expect(textCollapse()).toHaveClass('MuiCollapse-entered'));

    fireEvent.mouseLeave(wrapper);
    await waitFor(() => expect(textCollapse()).toHaveClass('MuiCollapse-hidden'));
  });

  it('syncs hover state when the active prop changes', async () => {
    const { rerender } = render(
      <IconTextFader text="Search" active={false}>
        <span>icon</span>
      </IconTextFader>,
    );

    const textCollapse = () => screen.getByText('Search').closest('.MuiCollapse-root');
    expect(textCollapse()).toHaveClass('MuiCollapse-hidden');

    rerender(
      <IconTextFader text="Search" active={true}>
        <span>icon</span>
      </IconTextFader>,
    );

    await waitFor(() => expect(textCollapse()).toHaveClass('MuiCollapse-entered'));
  });
});
