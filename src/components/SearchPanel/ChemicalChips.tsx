import { i18n } from '@/helpers/i18n';
import { extractReagentNames } from '@/utils/search-query/extractPositiveTerms';
import { parseSearchQuery } from '@/utils/search-query/parseSearchQuery';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useMemo } from 'react';

/** Props for {@link ChemicalChips}. */
interface ChemicalChipsProps {
  /** The executed search query. */
  query: string;
  /** Called with the reagent name when a chip is clicked. */
  onSelect: (name: string) => void;
}

/**
 * One clickable chip per reagent in the executed query. A boolean query such as
 * `(sodium OR potassium) hydroxide OR potassium carbonate` expands to three chips.
 * @component
 * @category Components
 * @group Chemical Info
 * @param props - See {@link ChemicalChipsProps}.
 * @returns The chip row, or nothing when the query names no reagents.
 * @example
 * ```tsx
 * <ChemicalChips query="acetone" onSelect={setSelected} />
 * ```
 * @source
 */
export function ChemicalChips({ query, onSelect }: ChemicalChipsProps) {
  const names = useMemo(() => extractReagentNames(parseSearchQuery(query).ast), [query]);
  if (names.length === 0) return null;

  return (
    <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" alignItems="center">
      <Typography variant="body2" fontWeight={600}>
        {i18n('chem_info_searched_for')}
      </Typography>
      {names.map((name) => (
        <Chip
          key={name.toLowerCase()}
          size="small"
          label={name}
          onClick={() => onSelect(name)}
          aria-label={i18n('chem_info_chip_aria', [name])}
        />
      ))}
    </Stack>
  );
}
