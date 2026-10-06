import { NFPA_COLORS } from '@/constants/hazards';

/** Props for {@link NfpaDiamond}. */
interface NfpaDiamondProps {
  /** Health rating (0-4). */
  health?: string;
  /** Flammability rating (0-4). */
  fire?: string;
  /** Instability rating (0-4). */
  reactivity?: string;
  /** Special notice, e.g. `W` or `OX`. */
  special?: string;
  /** Rendered edge length in px. */
  size?: number;
}

/**
 * An NFPA 704 "fire diamond": blue health (left), red flammability (top), yellow instability
 * (right) and white special notice (bottom).
 * @component
 * @category Components
 * @group Chemical Info
 * @param props - See {@link NfpaDiamondProps}.
 * @returns The SVG diamond.
 * @example
 * ```tsx
 * <NfpaDiamond health="1" fire="3" reactivity="0" />
 * ```
 * @source
 */
export function NfpaDiamond({ health, fire, reactivity, special, size = 120 }: NfpaDiamondProps) {
  const label = `NFPA 704: health ${health ?? '?'}, fire ${fire ?? '?'}, reactivity ${reactivity ?? '?'}${special ? `, ${special}` : ''}`;
  const quadrants = [
    {
      points: '50,2 74,26 50,50 26,26',
      fill: NFPA_COLORS.fire,
      text: fire,
      x: 50,
      y: 31,
      ink: '#fff',
    },
    {
      points: '2,50 26,26 50,50 26,74',
      fill: NFPA_COLORS.health,
      text: health,
      x: 26,
      y: 55,
      ink: '#fff',
    },
    {
      points: '98,50 74,26 50,50 74,74',
      fill: NFPA_COLORS.reactivity,
      text: reactivity,
      x: 74,
      y: 55,
      ink: '#000',
    },
    {
      points: '50,98 74,74 50,50 26,74',
      fill: NFPA_COLORS.special,
      text: special,
      x: 50,
      y: 79,
      ink: '#000',
    },
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={label}>
      {quadrants.map((quadrant) => (
        <g key={quadrant.points}>
          <polygon points={quadrant.points} fill={quadrant.fill} stroke="#000" strokeWidth="1.5" />
          <text
            x={quadrant.x}
            y={quadrant.y}
            textAnchor="middle"
            fontSize="16"
            fontWeight="700"
            fill={quadrant.ink}
          >
            {quadrant.text ?? ''}
          </text>
        </g>
      ))}
    </svg>
  );
}
