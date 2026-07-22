import contributors from '@/data/contributors.json';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AboutModal from '../AboutModal';

describe('AboutModal', () => {
  const mockSetAboutOpen = vi.fn();

  beforeEach(() => {
    mockSetAboutOpen.mockClear();
  });

  it('renders modal when aboutOpen is true', () => {
    render(<AboutModal aboutOpen={true} setAboutOpen={mockSetAboutOpen} />);

    expect(screen.getByText('About ChemPal')).toBeInTheDocument();
    expect(
      screen.getByText(/Open source project aimed at helping amateur chemistry hobbyists/),
    ).toBeInTheDocument();
    expect(screen.getByText('Contributors')).toBeInTheDocument();
  });

  it('does not render modal when aboutOpen is false', () => {
    render(<AboutModal aboutOpen={false} setAboutOpen={mockSetAboutOpen} />);

    expect(screen.queryByText('About ChemPal')).not.toBeInTheDocument();
  });

  it('calls setAboutOpen when clicking the backdrop (outside the modal content)', () => {
    render(<AboutModal aboutOpen={true} setAboutOpen={mockSetAboutOpen} />);

    const backdrop = document.querySelector('.MuiBackdrop-root');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);

    expect(mockSetAboutOpen).toHaveBeenCalledWith(false);
  });

  it('does not call setAboutOpen when clicking inside the modal content', () => {
    render(<AboutModal aboutOpen={true} setAboutOpen={mockSetAboutOpen} />);

    fireEvent.click(screen.getByText('About ChemPal'));

    expect(mockSetAboutOpen).not.toHaveBeenCalled();
  });

  it('renders all contributor links with correct hrefs', () => {
    render(<AboutModal aboutOpen={true} setAboutOpen={mockSetAboutOpen} />);

    expect(contributors.length).toBeGreaterThan(0);
    for (const { name, github } of contributors) {
      const link = screen.getByText(name).closest('a');
      expect(link).toHaveAttribute('href', github);
    }
  });

  it('renders Homepage link with correct attributes', () => {
    render(<AboutModal aboutOpen={true} setAboutOpen={mockSetAboutOpen} />);

    const homepageButton = screen.getByTestId('homepage-button');
    expect(homepageButton).toHaveAttribute('href', __APP_HOMEPAGE__);
    expect(homepageButton).toHaveAttribute('target', '_blank');
    expect(homepageButton).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders GitHub link with correct attributes', () => {
    render(<AboutModal aboutOpen={true} setAboutOpen={mockSetAboutOpen} />);

    const githubButton = screen.getByTestId('github-button');
    expect(githubButton).toHaveAttribute('href', __APP_REPOSITORY__);
    expect(githubButton).toHaveAttribute('target', '_blank');
    expect(githubButton).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders Wiki link with correct attributes', () => {
    render(<AboutModal aboutOpen={true} setAboutOpen={mockSetAboutOpen} />);

    const wikiButton = screen.getByTestId('wiki-button');
    expect(wikiButton).toHaveAttribute('href', __APP_WIKI__);
    expect(wikiButton).toHaveAttribute('target', '_blank');
    expect(wikiButton).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders Privacy link with correct attributes', () => {
    render(<AboutModal aboutOpen={true} setAboutOpen={mockSetAboutOpen} />);

    const privacyButton = screen.getByTestId('privacy-button');
    expect(privacyButton).toHaveAttribute('href', __APP_PRIVACY__);
    expect(privacyButton).toHaveAttribute('target', '_blank');
    expect(privacyButton).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders Bugs link with correct attributes', () => {
    render(<AboutModal aboutOpen={true} setAboutOpen={mockSetAboutOpen} />);

    const bugsButton = screen.getByTestId('bugs-button');
    expect(bugsButton).toHaveAttribute('href', __APP_BUGS__);
    expect(bugsButton).toHaveAttribute('target', '_blank');
    expect(bugsButton).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('has correct ARIA attributes', () => {
    render(<AboutModal aboutOpen={true} setAboutOpen={mockSetAboutOpen} />);

    const modal = screen.getByTestId('about-modal');
    expect(modal).toHaveAttribute('aria-labelledby', 'application-title');
    expect(modal).toHaveAttribute('aria-describedby', 'application-description');
  });
});
