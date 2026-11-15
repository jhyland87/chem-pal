import {
  SUPPLIER_OUTCOME,
  type SupplierOutcome,
  type SupplierOutcomeStatus,
} from '@/constants/common';
import { i18n } from '@/helpers/i18n';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Popover from '@mui/material/Popover';
import Typography from '@mui/material/Typography';
import { useMemo, useState } from 'react';

/** Props for {@link SupplierStatusChip}. */
interface SupplierStatusChipProps {
  /** How each supplier's part of the most recent search ended. */
  outcomes: readonly SupplierOutcome[];
}

/** Statuses in the order the popover lists them: problems first. */
const STATUS_ORDER: readonly SupplierOutcomeStatus[] = [
  SUPPLIER_OUTCOME.FAILED,
  SUPPLIER_OUTCOME.RATE_LIMITED,
  SUPPLIER_OUTCOME.STOPPED,
  SUPPLIER_OUTCOME.EMPTY,
  SUPPLIER_OUTCOME.OK,
];

/** Statuses that mean a supplier did not finish its search. */
const PROBLEM_STATUSES: readonly SupplierOutcomeStatus[] = [
  SUPPLIER_OUTCOME.FAILED,
  SUPPLIER_OUTCOME.RATE_LIMITED,
  SUPPLIER_OUTCOME.STOPPED,
];

/**
 * Translated heading for a group of suppliers that share a status.
 * @param status - The outcome status.
 * @returns The heading text in the active locale.
 * @example
 * ```ts
 * statusHeading("failed"); // "Failed"
 * ```
 * @source
 */
function statusHeading(status: SupplierOutcomeStatus): string {
  switch (status) {
    case SUPPLIER_OUTCOME.FAILED:
      return i18n('supplier_status_failed');
    case SUPPLIER_OUTCOME.RATE_LIMITED:
      return i18n('supplier_status_rate_limited');
    case SUPPLIER_OUTCOME.STOPPED:
      return i18n('supplier_status_stopped');
    case SUPPLIER_OUTCOME.EMPTY:
      return i18n('supplier_status_empty');
    default:
      return i18n('supplier_status_ok');
  }
}

/**
 * Groups outcomes by status, in display order, with supplier names sorted.
 * @param outcomes - The per-supplier outcomes of a search.
 * @returns One entry per status that has at least one supplier.
 * @example
 * ```ts
 * groupOutcomes([
 *   { supplier: "Ambeed", status: "ok", resultCount: 3 },
 *   { supplier: "Carolina", status: "failed", resultCount: 0 },
 * ]);
 * // → [{ status: "failed", items: [Carolina] }, { status: "ok", items: [Ambeed] }]
 * ```
 * @source
 */
export function groupOutcomes(
  outcomes: readonly SupplierOutcome[],
): Array<{ status: SupplierOutcomeStatus; items: SupplierOutcome[] }> {
  return STATUS_ORDER.map((status) => ({
    status,
    items: outcomes
      .filter((outcome) => outcome.status === status)
      .sort((a, b) => a.supplier.localeCompare(b.supplier)),
  })).filter((group) => group.items.length > 0);
}

/**
 * Chip in the results header showing how many searched suppliers finished cleanly.
 * Clicking it lists every supplier by outcome, so a failed or throttled supplier is
 * visible instead of silently missing from the table.
 * @component
 * @category Components
 * @group Search Results
 * @param props - See {@link SupplierStatusChipProps}.
 * @returns The chip and its popover, or nothing when no outcomes are known.
 * @example
 * ```tsx
 * <SupplierStatusChip outcomes={supplierOutcomes} />
 * ```
 * @source
 */
export function SupplierStatusChip({ outcomes }: SupplierStatusChipProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const groups = useMemo(() => groupOutcomes(outcomes), [outcomes]);
  if (outcomes.length === 0) return null;

  const problems = outcomes.filter((o) => PROBLEM_STATUSES.includes(o.status)).length;
  const responded = outcomes.length - problems;

  return (
    <>
      <Chip
        size="small"
        variant="outlined"
        color={problems > 0 ? 'warning' : 'default'}
        label={i18n('supplier_status_summary', [String(responded), String(outcomes.length)])}
        onClick={(event) => setAnchor(event.currentTarget)}
        aria-label={i18n('supplier_status_aria')}
        aria-haspopup="dialog"
      />
      <Popover
        open={anchor !== null}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box sx={{ p: 1.5, maxWidth: 360, maxHeight: 360, overflowY: 'auto' }}>
          {groups.map(({ status, items }) => (
            <Box key={status} sx={{ mb: 1, '&:last-child': { mb: 0 } }}>
              <Typography variant="subtitle2">
                {statusHeading(status)} ({items.length})
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {items
                  .map((item) =>
                    item.resultCount > 0 ? `${item.supplier} (${item.resultCount})` : item.supplier,
                  )
                  .join(', ')}
              </Typography>
            </Box>
          ))}
        </Box>
      </Popover>
    </>
  );
}
