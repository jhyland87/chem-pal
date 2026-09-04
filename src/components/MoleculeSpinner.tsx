import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import type { StructureRecordType } from '@/helpers/pubchem';
import { resolveMolecule } from '@/utils/molecule/resolveMolecule';
import { stripHydrogens, type Molecule } from '@/utils/molecule/sdf';
import type { MoleculeSceneHandle } from '@/utils/molecule/scene';

/**
 * Where a {@link MoleculeSpinner} is in its resolve-and-render lifecycle.
 * @category Components
 * @source
 */
export type MoleculeSpinnerState = 'idle' | 'loading' | 'ready' | 'unavailable';

/**
 * What a {@link MoleculeSpinner} resolved, reported through
 * `MoleculeSpinnerProps.onStatusChange`. Everything but `state` is present only once a
 * structure has been drawn.
 * @category Components
 * @source
 */
export interface MoleculeSpinnerStatus {
  /** Current lifecycle state. */
  state: MoleculeSpinnerState;
  /** The CID the query resolved to. */
  cid?: PubChemCID;
  /** Whether PubChem served a real 3D conformer or the flat 2D fallback. */
  recordType?: StructureRecordType;
  /** Atoms actually drawn, after any hydrogen stripping. */
  atomCount?: number;
  /** Bonds actually drawn, after any hydrogen stripping. */
  bondCount?: number;
  /** Wall-clock milliseconds spent resolving and fetching from PubChem. */
  elapsedMs?: number;
}

/**
 * Props for {@link MoleculeSpinner}.
 * - `query` - The search query to depict. Changing it resolves a new structure.
 * - `size` - Canvas edge length in CSS pixels. Defaults to 128, matching the cube it replaces.
 * - `spinSeconds` - Seconds per revolution. Changing it retimes without rebuilding.
 * - `atomScale` - Multiplier on covalent radii; lower is more stick, less ball.
 * - `showHydrogens` - Draw explicit hydrogens. On by default; the full structure reads
 *   better than a bare skeleton.
 * - `fallback` - Rendered while resolving, and whenever the query has no drawable structure.
 * - `onStatusChange` - Notified on every lifecycle transition.
 * @category Components
 * @source
 */
export interface MoleculeSpinnerProps {
  query: string;
  size?: number;
  spinSeconds?: number;
  atomScale?: number;
  showHydrogens?: boolean;
  fallback?: ReactNode;
  onStatusChange?: (status: MoleculeSpinnerStatus) => void;
}

/** Default canvas edge length, matching the cubane loader it stands in for. */
const DEFAULT_SIZE = 128;

/** Default seconds per revolution — slow enough to read as deliberate, not frantic. */
const DEFAULT_SPIN_SECONDS = 6;

/**
 * Reports whether the viewer has asked for reduced motion.
 * @returns True when `prefers-reduced-motion: reduce` matches
 * @source
 */
function prefersReducedMotion(): boolean {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

/**
 * Renders the molecule a search query refers to as a slowly rotating ball-and-stick model,
 * as a drop-in replacement for a generic loading spinner.
 *
 * The structure comes from PubChem: the query is resolved to a CID, and its 3D conformer
 * fetched — falling back to the flat 2D record for the ionic and inorganic compounds
 * PubChem computes no conformer for, which a planar wobble keeps legible. When nothing
 * resolves, `fallback` is rendered instead, so the caller always has something on screen.
 *
 * three.js is loaded through a dynamic import, so the WebGL renderer stays out of the
 * initial bundle and only downloads once a structure is ready to draw. The component is
 * memoized and holds its scene in a ref: the surrounding loading UI re-renders constantly
 * as results arrive, and rebuilding the scene on each of those would restart the animation
 * and leak WebGL contexts.
 * @component
 * @category Components
 * @param props - The spinner props (see {@link MoleculeSpinnerProps}).
 * @returns The rotating structure, or the supplied fallback.
 * @example
 * ```tsx
 * <MoleculeSpinner
 *   query={executedQuery}
 *   fallback={<IconSpinner><img src="/static/images/cubane-loader.png" /></IconSpinner>}
 * />
 * ```
 * @source
 */
export const MoleculeSpinner = memo(function MoleculeSpinner(props: MoleculeSpinnerProps) {
  const {
    query,
    size = DEFAULT_SIZE,
    spinSeconds = DEFAULT_SPIN_SECONDS,
    atomScale,
    showHydrogens = true,
    fallback,
    onStatusChange,
  } = props;

  const [molecule, setMolecule] = useState<Molecule | undefined>();
  const [sceneFailed, setSceneFailed] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<MoleculeSceneHandle | undefined>(undefined);

  // Read through refs inside effects that must not re-run when these change.
  const statusRef = useRef(onStatusChange);
  statusRef.current = onStatusChange;
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const spinRef = useRef(spinSeconds);
  spinRef.current = spinSeconds;

  useEffect(() => {
    let cancelled = false;
    setMolecule(undefined);
    setSceneFailed(false);

    if (query.trim() === '') {
      statusRef.current?.({ state: 'idle' });
      return;
    }

    statusRef.current?.({ state: 'loading' });
    const startedAt = performance.now();

    const resolve = async () => {
      const resolved = await resolveMolecule(query);
      if (cancelled) return;

      if (!resolved) {
        statusRef.current?.({ state: 'unavailable', elapsedMs: performance.now() - startedAt });
        return;
      }

      const drawn = showHydrogens ? resolved.molecule : stripHydrogens(resolved.molecule);
      setMolecule(drawn);
      statusRef.current?.({
        state: 'ready',
        cid: resolved.cid,
        recordType: resolved.recordType,
        atomCount: drawn.atoms.length,
        bondCount: drawn.bonds.length,
        elapsedMs: performance.now() - startedAt,
      });
    };

    void resolve();
    return () => {
      cancelled = true;
    };
  }, [query, showHydrogens]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!molecule || !canvas) return;

    let cancelled = false;
    const build = async () => {
      try {
        const { createMoleculeScene } = await import('@/utils/molecule/scene');
        if (cancelled) return;
        handleRef.current = createMoleculeScene(canvas, molecule, {
          size: sizeRef.current,
          spinSeconds: spinRef.current,
          atomScale,
          reducedMotion: prefersReducedMotion(),
        });
      } catch (error) {
        // WebGL can be unavailable entirely (blocklisted GPU, too many live contexts,
        // a non-rendering test environment). Drop back to the caller's fallback rather
        // than leaving an empty canvas or an unhandled rejection.
        console.error('Could not render molecule; falling back:', error);
        if (!cancelled) setSceneFailed(true);
      }
    };

    void build();
    return () => {
      cancelled = true;
      handleRef.current?.dispose();
      handleRef.current = undefined;
    };
  }, [molecule, atomScale]);

  useEffect(() => {
    handleRef.current?.setSize(size);
  }, [size]);

  useEffect(() => {
    handleRef.current?.setSpinSeconds(spinSeconds);
  }, [spinSeconds]);

  if (!molecule || sceneFailed) return <>{fallback}</>;

  return (
    <canvas
      ref={canvasRef}
      data-testid="molecule-spinner"
      style={{ width: size, height: size, display: 'block' }}
    />
  );
});
