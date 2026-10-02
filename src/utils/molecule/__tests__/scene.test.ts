import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Group, InstancedMesh, type Scene } from 'three';
import { createMoleculeScene } from '@/utils/molecule/scene';
import type { Molecule } from '@/utils/molecule/sdf';

const renderer = vi.hoisted(() => ({
  setPixelRatio: vi.fn(),
  setSize: vi.fn(),
  render: vi.fn(),
  dispose: vi.fn(),
  forceContextLoss: vi.fn(),
}));

// jsdom has no WebGL, so only the renderer is stubbed; geometry and math stay real.
vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  return {
    ...actual,
    WebGLRenderer: class {
      constructor() {
        return renderer;
      }
    },
  };
});

const WATER: Molecule = {
  atoms: [
    { symbol: 'O', x: 0, y: 0, z: 0 },
    { symbol: 'H', x: 0.96, y: 0, z: 0 },
    { symbol: 'H', x: -0.24, y: 0.93, z: 0 },
  ],
  bonds: [
    { from: 0, to: 1, order: 1 },
    { from: 0, to: 2, order: 1 },
  ],
  isPlanar: true,
};

const CO2: Molecule = {
  atoms: [
    { symbol: 'C', x: 0, y: 0, z: 0 },
    { symbol: 'O', x: 1.16, y: 0, z: 0 },
    { symbol: 'O', x: -1.16, y: 0.1, z: 0.3 },
  ],
  bonds: [
    { from: 0, to: 1, order: 2 },
    { from: 0, to: 2, order: 3 },
  ],
  isPlanar: false,
};

const LONE_ATOM: Molecule = {
  atoms: [{ symbol: 'Xx', x: 5, y: 5, z: 5 }],
  bonds: [],
  isPlanar: false,
};

const canvas = document.createElement('canvas');
const OPTIONS = { size: 100, spinSeconds: 4 };

/** The scene handed to the most recent `renderer.render` call. */
function renderedScene(): Scene {
  return renderer.render.mock.calls.at(-1)?.[0];
}

/** The molecule group (the scene child holding the instanced meshes). */
function moleculeGroup(): Group {
  const group = renderedScene().children.find((child) => child instanceof Group);
  if (!(group instanceof Group)) throw new Error('no molecule group');
  return group;
}

describe('createMoleculeScene', () => {
  let nextFrame: FrameRequestCallback | undefined;

  beforeEach(() => {
    Object.values(renderer).forEach((fn) => fn.mockClear());
    nextFrame = undefined;
    vi.spyOn(performance, 'now').mockReturnValue(0);
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        nextFrame = callback;
        return 7;
      }),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sizes the renderer and caps the pixel ratio at 2', () => {
    vi.stubGlobal('devicePixelRatio', 3);
    createMoleculeScene(canvas, WATER, OPTIONS);

    expect(renderer.setPixelRatio).toHaveBeenCalledWith(2);
    expect(renderer.setSize).toHaveBeenCalledWith(100, 100);
  });

  it('builds one atom mesh and one bond mesh with a slot per stick half', () => {
    createMoleculeScene(canvas, CO2, { ...OPTIONS, reducedMotion: true });

    const meshes = moleculeGroup().children.filter(
      (c): c is InstancedMesh => c instanceof InstancedMesh,
    );
    // 3 atoms; a double (2 sticks) + triple (3 sticks) bond, each stick split in two halves.
    expect(meshes.map((mesh) => mesh.count)).toEqual([3, 10]);
  });

  it('omits the bond mesh for a molecule without bonds', () => {
    createMoleculeScene(canvas, LONE_ATOM, { ...OPTIONS, reducedMotion: true });

    expect(moleculeGroup().children).toHaveLength(1);
  });

  it('includes ambient plus two directional lights', () => {
    createMoleculeScene(canvas, WATER, { ...OPTIONS, reducedMotion: true });

    expect(renderedScene().children.filter((c) => 'isLight' in c)).toHaveLength(3);
  });

  describe('reduced motion', () => {
    it.each([
      ['planar', WATER, 0],
      ['non-planar', CO2, 0.7],
    ])('renders one static frame for a %s molecule', (_label, molecule, rotationY) => {
      createMoleculeScene(canvas, molecule, { ...OPTIONS, reducedMotion: true });

      expect(renderer.render).toHaveBeenCalledOnce();
      expect(requestAnimationFrame).not.toHaveBeenCalled();
      expect(moleculeGroup().rotation.y).toBe(rotationY);
    });
  });

  describe('animation', () => {
    it('schedules frames and spins a non-planar molecule', () => {
      createMoleculeScene(canvas, CO2, OPTIONS);
      expect(renderer.render).not.toHaveBeenCalled();

      nextFrame?.(1000); // one second of a four-second revolution
      expect(moleculeGroup().rotation.y).toBeCloseTo(Math.PI / 2);
      expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
    });

    it('wobbles a planar molecule instead of spinning it', () => {
      createMoleculeScene(canvas, WATER, OPTIONS);

      nextFrame?.(1000);
      expect(moleculeGroup().rotation.y).toBeCloseTo(0.7 * Math.sin(Math.PI / 2));
    });
  });

  describe('handle', () => {
    it('setSpinSeconds keeps the current angle', () => {
      const handle = createMoleculeScene(canvas, CO2, OPTIONS);
      nextFrame?.(1000);
      const before = moleculeGroup().rotation.y;

      handle.setSpinSeconds(8);
      nextFrame?.(1000); // zero elapsed delta

      expect(moleculeGroup().rotation.y).toBeCloseTo(before);
    });

    it('setSpinSeconds clamps a non-positive period', () => {
      const handle = createMoleculeScene(canvas, CO2, OPTIONS);

      expect(() => handle.setSpinSeconds(0)).not.toThrow();
    });

    it('setSize resizes the renderer', () => {
      const handle = createMoleculeScene(canvas, WATER, OPTIONS);
      handle.setSize(240);

      expect(renderer.setSize).toHaveBeenLastCalledWith(240, 240);
    });

    it('dispose cancels the loop and frees GPU resources', () => {
      const handle = createMoleculeScene(canvas, CO2, OPTIONS);
      nextFrame?.(16);
      handle.dispose();

      expect(cancelAnimationFrame).toHaveBeenCalledWith(7);
      expect(renderer.dispose).toHaveBeenCalledOnce();
      expect(renderer.forceContextLoss).toHaveBeenCalledOnce();
    });

    it('dispose is safe for a bond-less molecule', () => {
      const handle = createMoleculeScene(canvas, LONE_ATOM, OPTIONS);

      expect(() => handle.dispose()).not.toThrow();
    });
  });
});
