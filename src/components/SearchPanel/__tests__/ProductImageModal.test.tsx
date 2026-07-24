import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProductImageModal } from '../ProductImageModal';

const images = [
  { thumbSrc: 'https://example.com/a-thumb.jpg', fullSrc: 'https://example.com/a.jpg' },
  { thumbSrc: 'https://example.com/b-thumb.jpg', fullSrc: 'https://example.com/b.jpg' },
  { thumbSrc: 'https://example.com/c-thumb.jpg', fullSrc: 'https://example.com/c.jpg' },
];

const stage = () => screen.getByRole('img', { name: 'Geraniol' });

describe('ProductImageModal', () => {
  it('renders nothing when closed', () => {
    render(
      <ProductImageModal
        open={false}
        onClose={vi.fn()}
        images={images}
        title="Geraniol"
        initialIndex={0}
      />,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows the enlarged full-size image at the initial index', () => {
    render(
      <ProductImageModal
        open
        onClose={vi.fn()}
        images={images}
        title="Geraniol"
        initialIndex={1}
      />,
    );
    expect(stage()).toHaveAttribute('src', 'https://example.com/b.jpg');
  });

  it('cycles the enlarged image forward and backward with wrap-around', () => {
    render(
      <ProductImageModal
        open
        onClose={vi.fn()}
        images={images}
        title="Geraniol"
        initialIndex={0}
      />,
    );
    const next = screen.getByLabelText(/next/i);
    const prev = screen.getByLabelText(/prev/i);

    expect(stage()).toHaveAttribute('src', 'https://example.com/a.jpg');
    fireEvent.click(next);
    expect(stage()).toHaveAttribute('src', 'https://example.com/b.jpg');
    fireEvent.click(next);
    fireEvent.click(next); // wraps back to the first
    expect(stage()).toHaveAttribute('src', 'https://example.com/a.jpg');
    fireEvent.click(prev); // wraps to the last
    expect(stage()).toHaveAttribute('src', 'https://example.com/c.jpg');
  });

  it('loads the clicked thumbnail into the enlarged view', () => {
    render(
      <ProductImageModal
        open
        onClose={vi.fn()}
        images={images}
        title="Geraniol"
        initialIndex={0}
      />,
    );
    fireEvent.click(screen.getByLabelText(/show image 3/i));
    expect(stage()).toHaveAttribute('src', 'https://example.com/c.jpg');
  });

  it('shows no arrows or thumbnail strip for a single image', () => {
    render(
      <ProductImageModal
        open
        onClose={vi.fn()}
        images={[images[0]]}
        title="Geraniol"
        initialIndex={0}
      />,
    );
    expect(screen.queryByLabelText(/next/i)).toBeNull();
    expect(screen.queryByLabelText(/prev/i)).toBeNull();
    expect(screen.queryByLabelText(/show image/i)).toBeNull();
  });

  it('falls back to the thumbnail when the full-size image fails to load', () => {
    render(
      <ProductImageModal
        open
        onClose={vi.fn()}
        images={images}
        title="Geraniol"
        initialIndex={0}
      />,
    );
    fireEvent.error(stage());
    expect(stage()).toHaveAttribute('src', 'https://example.com/a-thumb.jpg');
  });

  it('invokes onClose from the close button', () => {
    const onClose = vi.fn();
    render(
      <ProductImageModal
        open
        onClose={onClose}
        images={images}
        title="Geraniol"
        initialIndex={0}
      />,
    );
    fireEvent.click(screen.getByLabelText(/close/i));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('reseeds to the initial index each time it reopens', () => {
    const { rerender } = render(
      <ProductImageModal
        open
        onClose={vi.fn()}
        images={images}
        title="Geraniol"
        initialIndex={0}
      />,
    );
    fireEvent.click(screen.getByLabelText(/next/i));
    expect(stage()).toHaveAttribute('src', 'https://example.com/b.jpg');

    const props = { onClose: vi.fn(), images, title: 'Geraniol', initialIndex: 0 };
    rerender(<ProductImageModal open={false} {...props} />);
    rerender(<ProductImageModal open {...props} />);
    expect(stage()).toHaveAttribute('src', 'https://example.com/a.jpg');
  });
});
