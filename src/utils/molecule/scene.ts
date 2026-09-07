/**
 * Builds and animates a three.js ball-and-stick scene for a parsed molecule.
 *
 * This module statically imports `three`, so every consumer should reach it through a
 * dynamic `import()` — that keeps the WebGL renderer out of the initial popup bundle and
 * loads it only when a structure is actually going to be drawn.
 * @module
 * @categoryDescription Utils
 * @showCategories
 */

import {
  AmbientLight,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  PerspectiveCamera,
  Quaternion,
  Scene,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from 'three';
import { elementStyle } from '@/utils/molecule/elements';
import type { Molecule } from '@/utils/molecule/sdf';

/**
 * Tunables for {@link createMoleculeScene}.
 * @category Utils
 * @group Types
 * @source
 */
export interface MoleculeSceneOptions {
  /** Canvas edge length in CSS pixels; the scene is always square. */
  size: number;
  /** Seconds per full revolution (or per wobble cycle for a planar structure). */
  spinSeconds: number;
  /** Multiplier applied to `ATOM_RADIUS`. Lower is more stick, less ball. */
  atomScale?: number;
  /** When true, render a single static frame instead of animating. */
  reducedMotion?: boolean;
}

/**
 * Live controls over a running molecule scene.
 * @category Utils
 * @group Types
 * @source
 */
export interface MoleculeSceneHandle {
  /** Changes the rotation period without rebuilding the scene. */
  setSpinSeconds(seconds: number): void;
  /** Resizes the canvas and updates the projection. */
  setSize(size: number): void;
  /** Stops the animation loop and releases every GPU resource. */
  dispose(): void;
}

/** Latitude/longitude segments for atom spheres — smooth at render size, cheap to draw. */
const SPHERE_SEGMENTS = 20;
const SPHERE_RINGS = 14;

/** Radial segments for bond cylinders. */
const CYLINDER_SEGMENTS = 10;

/** Bond stick radius, in angstroms. */
const BOND_RADIUS = 0.09;

/** Lateral separation between the parallel sticks of a double or triple bond, in angstroms. */
const BOND_OFFSET = 0.17;

/**
 * Radius, in angstroms, drawn for every atom regardless of element.
 *
 * Sizing spheres by covalent radius is chemically faithful but reads badly at this scale:
 * in a small species like KOH the potassium (2.03 A) dwarfs its oxygen and hydrogen and
 * the model becomes one big ball with specks attached. A uniform radius keeps the shape of
 * the structure legible; element identity is carried by colour alone.
 */
const ATOM_RADIUS = 1;

/** Default multiplier applied to `ATOM_RADIUS` when sizing atom spheres. */
const DEFAULT_ATOM_SCALE = 0.28;

/** Fixed downward tilt, in radians, so the spin axis is never edge-on to the camera. */
const TILT_X = 0.26;

/** Peak yaw of the planar wobble, in radians (~40°). */
const PLANAR_SWING = 0.7;

/** Vertical camera field of view, in degrees. */
const CAMERA_FOV = 40;

/**
 * Extra room left around the fitted half-extent. Must exceed `1 + tan(fov/2)` (~1.36 at a
 * 40° field of view): the extent is measured in the centre plane, and perspective magnifies
 * an atom that swings toward the camera, which would otherwise clip at the frame edge.
 */
const FIT_MARGIN = 1.4;

/**
 * Half-extent, in angstroms, that a structure must reach before it fills the frame.
 * Anything smaller is fitted as though it were this big, so it renders proportionally
 * smaller rather than being zoomed until it fills the canvas. A handful of atoms magnified
 * to fill a 300px panel reads as abstract blobs rather than a structure.
 */
const MIN_FIT_RADIUS = 2;

/** Canonical axis a three.js cylinder points along before rotation. */
const CYLINDER_AXIS = new Vector3(0, 1, 0);

/**
 * How many parallel sticks to draw for a bond order. Aromatic bonds (order 4) are drawn
 * as a double bond, which is how they read at these sizes.
 * @param order - Bond order from the SDF bond block
 * @returns The number of parallel sticks to draw
 * @source
 */
function stickCount(order: number): number {
  switch (order) {
    case 2:
      return 2;
    case 3:
      return 3;
    case 4:
      return 2;
    default:
      return 1;
  }
}

/**
 * Lateral offsets, in multiples of {@link BOND_OFFSET}, that centre `count` parallel
 * sticks about the bond axis.
 * @param count - How many sticks the bond is drawn with
 * @returns One offset multiplier per stick
 * @source
 */
function stickOffsets(count: number): number[] {
  const offsets: number[] = [];
  for (let i = 0; i < count; i++) {
    offsets.push(i - (count - 1) / 2);
  }
  return offsets;
}

/**
 * Finds a unit vector perpendicular to `direction`, used to fan out the parallel sticks of
 * a multiple bond. Picks whichever reference axis is least parallel to the bond so the
 * cross product is never degenerate.
 * @param direction - The normalized bond direction
 * @returns A unit vector perpendicular to `direction`
 * @source
 */
function perpendicularTo(direction: Vector3): Vector3 {
  const reference = Math.abs(direction.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
  return new Vector3().crossVectors(direction, reference).normalize();
}

/**
 * Atom positions recentred on the molecule's centroid, plus the half-extent the structure
 * sweeps out as it spins — the value the camera is fitted to.
 * @param molecule - The molecule to measure
 * @param atomScale - Multiplier applied to `ATOM_RADIUS`
 * @returns The recentred positions and the half-extent to fit
 * @source
 */
function centreAtoms(
  molecule: Molecule,
  atomScale: number,
): { positions: Vector3[]; radius: number } {
  const centroid = new Vector3();
  for (const atom of molecule.atoms) {
    centroid.add(new Vector3(atom.x, atom.y, atom.z));
  }
  centroid.divideScalar(molecule.atoms.length);

  const positions = molecule.atoms.map((atom) => new Vector3(atom.x, atom.y, atom.z).sub(centroid));

  // Fit the extent the molecule actually sweeps out, not its bounding sphere. A sphere
  // through the furthest atom is mostly empty air for anything that is not roughly round
  // — an ion pair like KMnO4 wastes half the frame — so the structure renders far smaller
  // than it could. Spinning about Y, the widest horizontal reach of an atom is its radius
  // in the XZ plane, and its vertical reach is |y|; taking the larger of those two maxima
  // fills a square frame at every point in the rotation without ever clipping.
  const atomRadius = ATOM_RADIUS * atomScale;
  let horizontal = MIN_FIT_RADIUS;
  let vertical = MIN_FIT_RADIUS;
  for (const position of positions) {
    horizontal = Math.max(horizontal, Math.hypot(position.x, position.z) + atomRadius);
    vertical = Math.max(vertical, Math.abs(position.y) + atomRadius);
  }
  return { positions, radius: Math.max(horizontal, vertical) };
}

/**
 * Builds the instanced mesh holding every atom sphere.
 * @param molecule - The molecule being drawn
 * @param positions - Recentred atom positions
 * @param atomScale - Multiplier applied to `ATOM_RADIUS`
 * @returns An instanced sphere mesh, one instance per atom
 * @source
 */
function buildAtomMesh(molecule: Molecule, positions: Vector3[], atomScale: number): InstancedMesh {
  const geometry = new SphereGeometry(1, SPHERE_SEGMENTS, SPHERE_RINGS);
  const material = new MeshStandardMaterial({ roughness: 0.35, metalness: 0.05 });
  const mesh = new InstancedMesh(geometry, material, molecule.atoms.length);

  const matrix = new Matrix4();
  const rotation = new Quaternion();
  const scale = new Vector3();
  const colour = new Color();

  const size = ATOM_RADIUS * atomScale;
  scale.set(size, size, size);

  for (const [index, atom] of molecule.atoms.entries()) {
    const style = elementStyle(atom.symbol);
    matrix.compose(positions[index], rotation, scale);
    mesh.setMatrixAt(index, matrix);
    mesh.setColorAt(index, colour.setHex(style.color));
  }
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

/**
 * Writes one half-bond cylinder into an instanced mesh, stretched and oriented to span
 * `start` to `end`.
 * @param mesh - The instanced cylinder mesh being filled
 * @param index - Instance slot to write
 * @param start - Segment start point
 * @param end - Segment end point
 * @param colour - Colour for this segment
 * @source
 */
function writeBondSegment(
  mesh: InstancedMesh,
  index: number,
  start: Vector3,
  end: Vector3,
  colour: Color,
): void {
  const direction = new Vector3().subVectors(end, start);
  const length = direction.length();
  if (length === 0) return;

  const matrix = new Matrix4();
  const rotation = new Quaternion().setFromUnitVectors(
    CYLINDER_AXIS,
    direction.clone().normalize(),
  );
  const centre = new Vector3().addVectors(start, end).multiplyScalar(0.5);
  matrix.compose(centre, rotation, new Vector3(BOND_RADIUS, length, BOND_RADIUS));
  mesh.setMatrixAt(index, matrix);
  mesh.setColorAt(index, colour);
}

/**
 * Builds the instanced mesh holding every bond, splitting each stick at its midpoint so
 * each half takes the colour of the atom it grows from.
 * @param molecule - The molecule being drawn
 * @param positions - Recentred atom positions
 * @returns An instanced cylinder mesh, or undefined when the molecule has no bonds
 * @source
 */
function buildBondMesh(molecule: Molecule, positions: Vector3[]): InstancedMesh | undefined {
  let segmentCount = 0;
  for (const bond of molecule.bonds) {
    segmentCount += stickCount(bond.order) * 2;
  }
  if (segmentCount === 0) return undefined;

  const geometry = new CylinderGeometry(1, 1, 1, CYLINDER_SEGMENTS);
  const material = new MeshStandardMaterial({ roughness: 0.4, metalness: 0.05 });
  const mesh = new InstancedMesh(geometry, material, segmentCount);

  const fromColour = new Color();
  const toColour = new Color();
  let slot = 0;

  for (const bond of molecule.bonds) {
    const start = positions[bond.from];
    const end = positions[bond.to];
    const direction = new Vector3().subVectors(end, start).normalize();
    const perpendicular = perpendicularTo(direction);
    fromColour.setHex(elementStyle(molecule.atoms[bond.from].symbol).color);
    toColour.setHex(elementStyle(molecule.atoms[bond.to].symbol).color);

    for (const multiplier of stickOffsets(stickCount(bond.order))) {
      const shift = perpendicular.clone().multiplyScalar(multiplier * BOND_OFFSET);
      const a = start.clone().add(shift);
      const b = end.clone().add(shift);
      const midpoint = new Vector3().addVectors(a, b).multiplyScalar(0.5);
      writeBondSegment(mesh, slot++, a, midpoint, fromColour);
      writeBondSegment(mesh, slot++, midpoint, b, toColour);
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

/**
 * Releases the GPU resources held by an instanced mesh — its geometry, its material (or
 * every material, if it was built with several) and its own instance buffers.
 * @param mesh - The mesh to dispose
 * @source
 */
function disposeMesh(mesh: InstancedMesh): void {
  mesh.geometry.dispose();
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const material of materials) {
    material.dispose();
  }
  mesh.dispose();
}

/**
 * Adds the three-point-ish lighting rig the ball-and-stick materials are tuned for.
 * @param scene - The scene to light
 * @source
 */
function addLighting(scene: Scene): void {
  scene.add(new AmbientLight(0xff_ff_ff, 1.1));

  const key = new DirectionalLight(0xff_ff_ff, 2.2);
  key.position.set(2, 3, 4);
  scene.add(key);

  const fill = new DirectionalLight(0xff_ff_ff, 0.8);
  fill.position.set(-3, -1, 2);
  scene.add(fill);
}

/**
 * Builds a ball-and-stick scene for `molecule` on `canvas` and starts animating it.
 *
 * A structure with real 3D coordinates rotates continuously about its vertical axis. A
 * planar structure — every 2D record, and flat 3D ones like benzene — instead *wobbles*
 * through a ±`PLANAR_SWING` yaw arc (~40°): spinning a flat molecule a full turn would
 * take it edge-on twice per revolution, where it briefly vanishes.
 * @category Utils
 * @param canvas - The canvas element to render into
 * @param molecule - The parsed structure to draw
 * @param options - Size, spin period and rendering tunables
 * @returns A handle for resizing, retiming and disposing the scene
 * @example
 * ```typescript
 * const { createMoleculeScene } = await import('@/utils/molecule/scene');
 * const handle = createMoleculeScene(canvas, molecule, { size: 160, spinSeconds: 8 });
 * handle.setSpinSeconds(4);
 * handle.dispose();
 * ```
 * @source
 */
export function createMoleculeScene(
  canvas: HTMLCanvasElement,
  molecule: Molecule,
  options: MoleculeSceneOptions,
): MoleculeSceneHandle {
  const atomScale = options.atomScale ?? DEFAULT_ATOM_SCALE;
  const { positions, radius } = centreAtoms(molecule, atomScale);

  const scene = new Scene();
  addLighting(scene);

  const group = new Group();
  group.rotation.x = TILT_X;
  scene.add(group);

  const atomMesh = buildAtomMesh(molecule, positions, atomScale);
  group.add(atomMesh);
  const bondMesh = buildBondMesh(molecule, positions);
  if (bondMesh) group.add(bondMesh);

  const camera = new PerspectiveCamera(CAMERA_FOV, 1, 0.1, 1000);
  camera.position.z = (radius * FIT_MARGIN) / Math.tan((CAMERA_FOV * Math.PI) / 360);

  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio, 2));
  renderer.setSize(options.size, options.size);

  let spinSeconds = options.spinSeconds;
  let elapsed = 0;
  let lastFrame = performance.now();
  let frameHandle = 0;

  /**
   * Advances the rotation for a frame and redraws.
   * @param now - High-resolution timestamp supplied by `requestAnimationFrame`
   * @source
   */
  function renderFrame(now: number): void {
    const delta = (now - lastFrame) / 1000;
    lastFrame = now;
    elapsed += delta;

    const turns = (elapsed * 2 * Math.PI) / Math.max(spinSeconds, 0.1);
    group.rotation.y = molecule.isPlanar ? Math.sin(turns) * PLANAR_SWING : turns;

    renderer.render(scene, camera);
    frameHandle = requestAnimationFrame(renderFrame);
  }

  if (options.reducedMotion) {
    group.rotation.y = molecule.isPlanar ? 0 : PLANAR_SWING;
    renderer.render(scene, camera);
  } else {
    frameHandle = requestAnimationFrame(renderFrame);
  }

  return {
    setSpinSeconds(seconds: number): void {
      // Rebase the clock so the molecule keeps its current angle instead of jumping.
      const turns = (elapsed * 2 * Math.PI) / Math.max(spinSeconds, 0.1);
      spinSeconds = seconds;
      elapsed = (turns * Math.max(seconds, 0.1)) / (2 * Math.PI);
    },
    setSize(size: number): void {
      renderer.setSize(size, size);
    },
    dispose(): void {
      cancelAnimationFrame(frameHandle);
      disposeMesh(atomMesh);
      if (bondMesh) disposeMesh(bondMesh);
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
