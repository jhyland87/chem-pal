import { ProductBuilder } from '@/utils/ProductBuilder';
import { beforeEach, describe, expect, it } from 'vitest';

describe('ProductBuilder images', () => {
  let builder: ProductBuilder<Product>;

  beforeEach(() => {
    builder = new ProductBuilder<Product>('https://example.com');
  });

  it('appends a full image with alt text via addImage', () => {
    builder.addImage('https://example.com/a.jpg', 'front label');

    expect(builder.get('images')).toEqual([
      { href: 'https://example.com/a.jpg', type: 'image', altText: 'front label' },
    ]);
  });

  it('appends a thumbnail via addThumbnail', () => {
    builder.addThumbnail('https://example.com/a-t.jpg');

    expect(builder.get('images')).toEqual([
      { href: 'https://example.com/a-t.jpg', type: 'thumbnail' },
    ]);
  });

  it('keeps images and thumbnails as separate typed entries', () => {
    builder
      .addImage('https://example.com/a.jpg')
      .addThumbnail('https://example.com/a-t.jpg')
      .addImage('https://example.com/b.jpg');

    expect(builder.get('images')).toEqual([
      { href: 'https://example.com/a.jpg', type: 'image' },
      { href: 'https://example.com/a-t.jpg', type: 'thumbnail' },
      { href: 'https://example.com/b.jpg', type: 'image' },
    ]);
  });

  it('makes setImage the default image, placed ahead of added images', () => {
    builder.addImage('https://example.com/gallery.jpg').setImage('https://example.com/main.jpg');

    expect(builder.get('images')).toEqual([
      { href: 'https://example.com/main.jpg', type: 'image' },
      { href: 'https://example.com/gallery.jpg', type: 'image' },
    ]);
  });

  it('keeps the default thumbnail first among thumbnails via setThumbnail', () => {
    builder
      .addThumbnail('https://example.com/extra-t.jpg')
      .setThumbnail('https://example.com/main-t.jpg');

    expect(builder.get('images')).toEqual([
      { href: 'https://example.com/main-t.jpg', type: 'thumbnail' },
      { href: 'https://example.com/extra-t.jpg', type: 'thumbnail' },
    ]);
  });

  it('ignores empty image and thumbnail URLs', () => {
    builder.setImage('').addThumbnail('   ');

    expect(builder.get('images')).toBeUndefined();
  });

  it('adds raw URL strings as full images via addImages', () => {
    builder.addImages(['https://example.com/a.jpg', 'https://example.com/b.jpg']);

    expect(builder.get('images')).toEqual([
      { href: 'https://example.com/a.jpg', type: 'image' },
      { href: 'https://example.com/b.jpg', type: 'image' },
    ]);
  });

  it('adds raw URL strings as thumbnails via addThumbnails', () => {
    builder.addThumbnails(['https://example.com/a-t.jpg', 'https://example.com/b-t.jpg']);

    expect(builder.get('images')).toEqual([
      { href: 'https://example.com/a-t.jpg', type: 'thumbnail' },
      { href: 'https://example.com/b-t.jpg', type: 'thumbnail' },
    ]);
  });

  it('preserves the explicit type of pre-built entries mixed with raw URLs', () => {
    builder.addImages([
      'https://example.com/a.jpg',
      { href: 'https://example.com/a-t.jpg', type: 'thumbnail' },
    ]);

    expect(builder.get('images')).toEqual([
      { href: 'https://example.com/a.jpg', type: 'image' },
      { href: 'https://example.com/a-t.jpg', type: 'thumbnail' },
    ]);
  });

  it('appends typed entries via addImages, skipping invalid ones', () => {
    builder.addImages([
      { href: 'https://example.com/a.jpg', type: 'image', altText: 'front' },
      { href: 'https://example.com/a-t.jpg', type: 'thumbnail' },
      { href: '', type: 'image' },
      { href: 'https://example.com/b.jpg', type: 'banner' },
    ]);

    expect(builder.get('images')).toEqual([
      { href: 'https://example.com/a.jpg', type: 'image', altText: 'front' },
      { href: 'https://example.com/a-t.jpg', type: 'thumbnail' },
    ]);
  });

  it('hydrates images through setData', () => {
    builder.setData({
      images: [{ href: 'https://example.com/a.jpg', type: 'image', altText: 'front' }],
    });

    expect(builder.get('images')).toEqual([
      { href: 'https://example.com/a.jpg', type: 'image', altText: 'front' },
    ]);
  });
});
