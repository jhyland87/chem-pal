import { useAppContext } from "@/context";
import { SupplierFactory } from "@/suppliers/SupplierFactory";
import { i18n } from "@/helpers/i18n";
import { hexToRgba, SUPPLIER_COLORS } from "@/theme/colors";
import {
  classifySupplierHealth,
  filterStatsByRange,
  STATS_RANGES,
  statusLabelKey,
  type StatsRange,
  type SupplierHealthStatus,
} from "@/helpers/supplierStats";
import { clearStats, getStats } from "@/utils/SupplierStatsStore";
import { IDB_SUPPLIER_STATS_UPDATED } from "@/utils/idbCache";
import { Delete as DeleteIcon } from "@mui/icons-material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import {
  Box,
  IconButton,
  MenuItem,
  Paper,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha, styled, type Theme } from "@mui/material/styles";
import { LineChart } from "@mui/x-charts/LineChart";
import { PieChart } from "@mui/x-charts/PieChart";
import { useDrawingArea } from "@mui/x-charts/hooks";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { FC, ReactNode, useEffect, useMemo, useState } from "react";
import styles from "./StatsPanel.module.scss";
import { BackButton } from "./StyledComponents";

/** Center label for the pie chart */
const StyledText = styled("text")(({ theme }) => ({
  fill: theme.palette.text.primary,
  textAnchor: "middle",
  dominantBaseline: "central",
  fontSize: 16,
  fontWeight: 500,
}));

/**
 * Renders text centered in the hole of a MUI X pie chart, positioned via the
 * chart's drawing area. Used to show a total or label inside the pie.
 * @param props - Component props.
 * - `children` - The content to render at the pie's center.
 * @returns An SVG text element centered in the chart.
 * @example
 * ```tsx
 * <PieChart series={...}>
 *   <PieCenterLabel>1,234</PieCenterLabel>
 * </PieChart>
 * ```
 * @source
 */
function PieCenterLabel({ children }: { children: ReactNode }) {
  const { width, height, left, top } = useDrawingArea();
  return (
    <StyledText x={left + width / 2} y={top + height / 2}>
      {children}
    </StyledText>
  );
}

interface PieDatum {
  id: string;
  value: number;
  label: string;
  percentage: number;
  color: string;
}

type PieView = "http" | "parsed";

/**
 * StatsPanel displays per-supplier search statistics as a full panel view.
 * Three tabs: By Supplier (pie), Daily (bar), Totals (text).
 * The pie chart has two views toggled like the Titanic example:
 * - "HTTP Calls": inner = supplier totals, outer = success vs failure
 * - "Parsed Data": inner = supplier totals, outer = products vs parse errors
 * @category Components
 * @source
 */
const StatsPanel: FC = () => {
  const appContext = useAppContext();
  const [stats, setStats] = useState<SupplierStatsData>({});
  const [activeTab, setActiveTab] = useState(0);
  const [pieView, setPieView] = useState<PieView>("http");
  const [range, setRange] = useState<StatsRange>("all");

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await getStats();
        setStats(data);
      } catch (error) {
        console.warn(error);
      }
    };
    loadStats();
    // Re-read stats when supplier stats are updated in IndexedDB (live updates during search)
    const handler = () => loadStats();
    window.addEventListener(IDB_SUPPLIER_STATS_UPDATED, handler);
    return () => window.removeEventListener(IDB_SUPPLIER_STATS_UPDATED, handler);
  }, []);

  const handleClear = async () => {
    try {
      await clearStats();
      setStats({});
    } catch (error) {
      console.warn(error);
    }
  };

  // Stats are keyed by supplierName ("Carolina"), but userSettings.disabledSuppliers
  // holds class names ("SupplierCarolina"), so translate before comparing.
  const disabledSupplierNames = useMemo(() => {
    const disabledClassNames = appContext?.userSettings?.disabledSuppliers ?? [];
    const displayNames = SupplierFactory.supplierDisplayNames();
    return new Set(disabledClassNames.map((className) => displayNames[className] ?? className));
  }, [appContext?.userSettings?.disabledSuppliers]);

  // Every view (pies, daily chart, totals) reflects the selected range.
  const rangedStats = useMemo(() => filterStatsByRange(stats, range), [stats, range]);

  // Aggregate stats across the days in range
  const aggregatedBySupplier = useMemo(() => {
    const agg: Record<
      string,
      { success: number; failure: number; products: number; queries: number; parseErrors: number }
    > = {};
    for (const dayStats of Object.values(rangedStats)) {
      for (const [supplier, s] of Object.entries(dayStats)) {
        if (!agg[supplier])
          agg[supplier] = { success: 0, failure: 0, products: 0, queries: 0, parseErrors: 0 };
        agg[supplier].success += s.successCount;
        agg[supplier].failure += s.failureCount;
        agg[supplier].products += s.uniqueProductCount;
        agg[supplier].queries += s.searchQueryCount ?? 0;
        agg[supplier].parseErrors += s.parseErrorCount ?? 0;
      }
    }
    return agg;
  }, [rangedStats]);

  // Build supplier color map
  const supplierColorMap = useMemo(() => {
    const suppliers = Object.keys(aggregatedBySupplier);
    const colorMap: Record<string, string> = {};
    suppliers.forEach((s, i) => {
      colorMap[s] = SUPPLIER_COLORS[i % SUPPLIER_COLORS.length];
    });
    return colorMap;
  }, [aggregatedBySupplier]);

  // ── HTTP Calls view: inner = total HTTP calls per supplier, outer = success vs failure ──
  const httpPieData = useMemo(() => {
    const suppliers = Object.keys(aggregatedBySupplier);
    const totalCalls = suppliers.reduce(
      (sum, s) => sum + aggregatedBySupplier[s].success + aggregatedBySupplier[s].failure,
      0,
    );

    const inner: PieDatum[] = suppliers.map((supplier) => {
      const { success, failure } = aggregatedBySupplier[supplier];
      const total = success + failure;
      return {
        id: supplier,
        value: total,
        label: `${supplier}:`,
        percentage: totalCalls > 0 ? (total / totalCalls) * 100 : 0,
        color: supplierColorMap[supplier],
      };
    });

    // Exactly 2 entries per supplier (Yes/No pattern from Titanic example) so outer aligns with inner
    const outer: PieDatum[] = suppliers.flatMap((supplier) => {
      const { success, failure } = aggregatedBySupplier[supplier];
      const supplierTotal = success + failure;
      const baseColor = supplierColorMap[supplier];
      return [
        {
          id: `${supplier}-success`,
          label: i18n("stats_successes"),
          value: success,
          percentage: supplierTotal > 0 ? (success / supplierTotal) * 100 : 0,
          color: baseColor,
        },
        {
          id: `${supplier}-failure`,
          label: i18n("stats_fails"),
          value: failure,
          percentage: supplierTotal > 0 ? (failure / supplierTotal) * 100 : 0,
          color: hexToRgba(baseColor, 0.4),
        },
      ];
    });

    return { inner, outer, totalCalls };
  }, [aggregatedBySupplier, supplierColorMap]);

  // ── Parsed Data view: inner = total products + parse errors per supplier, outer = products vs parseErrors ──
  const parsedPieData = useMemo(() => {
    const suppliers = Object.keys(aggregatedBySupplier);
    const totalParsed = suppliers.reduce(
      (sum, s) => sum + aggregatedBySupplier[s].products + aggregatedBySupplier[s].parseErrors,
      0,
    );

    const inner: PieDatum[] = suppliers.map((supplier) => {
      const { products, parseErrors } = aggregatedBySupplier[supplier];
      const total = products + parseErrors;
      return {
        id: supplier,
        value: total,
        label: `${supplier}:`,
        percentage: totalParsed > 0 ? (total / totalParsed) * 100 : 0,
        color: supplierColorMap[supplier],
      };
    });

    const outer: PieDatum[] = suppliers.flatMap((supplier) => {
      const { products, parseErrors } = aggregatedBySupplier[supplier];
      const supplierTotal = products + parseErrors;
      const baseColor = supplierColorMap[supplier];
      return [
        {
          id: `${supplier}-parsed`,
          label: i18n("stats_successes"),
          value: products,
          percentage: supplierTotal > 0 ? (products / supplierTotal) * 100 : 0,
          color: baseColor,
        },
        {
          id: `${supplier}-parseError`,
          label: i18n("stats_fails"),
          value: parseErrors,
          percentage: supplierTotal > 0 ? (parseErrors / supplierTotal) * 100 : 0,
          color: hexToRgba(baseColor, 0.4),
        },
      ];
    });

    return { inner, outer, totalParsed };
  }, [aggregatedBySupplier, supplierColorMap]);

  // Line chart data — one line per supplier showing total calls over time
  const { lineSeries, lineDates } = useMemo(() => {
    const sortedDates = Object.keys(rangedStats).sort();

    const allSuppliers = new Set<string>();
    for (const dayStats of Object.values(rangedStats)) {
      for (const supplier of Object.keys(dayStats)) {
        allSuppliers.add(supplier);
      }
    }

    const series: Array<{
      data: number[];
      label: string;
      color: string;
      showMark: boolean;
      valueFormatter: (v: number | null) => string;
    }> = [];
    let colorIdx = 0;
    for (const supplier of allSuppliers) {
      const color = SUPPLIER_COLORS[colorIdx % SUPPLIER_COLORS.length];
      series.push({
        data: sortedDates.map((date) => {
          const s = stats[date]?.[supplier];
          return s ? s.successCount + s.failureCount : 0;
        }),
        label: supplier,
        color,
        showMark: true,
        valueFormatter: (v) => i18n("stats_calls", [String(v ?? 0)]),
      });
      colorIdx++;
    }

    return { lineSeries: series, lineDates: sortedDates.map((d) => d.slice(5)) };
  }, [rangedStats]);

  // Totals table
  const totalsColumns: GridColDef[] = [
    { field: "supplier", headerName: i18n("stats_col_supplier"), flex: 1, minWidth: 130 },
    { field: "queries", headerName: i18n("stats_col_queries"), width: 80, type: "number" },
    { field: "success", headerName: i18n("stats_col_success"), width: 80, type: "number" },
    { field: "failure", headerName: i18n("stats_col_failure"), width: 80, type: "number" },
    { field: "products", headerName: i18n("stats_col_products"), width: 85, type: "number" },
    {
      field: "parseErrors",
      headerName: i18n("stats_col_parse_errors"),
      width: 105,
      type: "number",
    },
    {
      field: "status",
      headerName: i18n("stats_col_status"),
      width: 150,
      valueFormatter: (value: SupplierHealthStatus) => i18n(statusLabelKey(value)),
    },
  ];

  // Dim, theme-aware row tints. Deliberately low-alpha: these mark rows worth a
  // look, they shouldn't shout over the numbers themselves.
  const statusRowSx = {
    "& .stats-row--noSuccess": {
      backgroundColor: (theme: Theme) => alpha(theme.palette.error.main, 0.16),
    },
    "& .stats-row--connectionErrors": {
      backgroundColor: (theme: Theme) => alpha(theme.palette.error.main, 0.09),
    },
    "& .stats-row--parseFailure": {
      backgroundColor: (theme: Theme) => alpha(theme.palette.error.main, 0.16),
    },
    "& .stats-row--parseErrors": {
      backgroundColor: (theme: Theme) => alpha(theme.palette.warning.main, 0.12),
    },
    // Not a fault — just greyed back so it reads as inactive rather than broken.
    "& .stats-row--disabled": {
      backgroundColor: (theme: Theme) => alpha(theme.palette.text.disabled, 0.08),
      color: "text.disabled",
    },
  };

  const totalsRows = useMemo(
    () =>
      Object.entries(aggregatedBySupplier).map(([supplier, s]) => {
        const { status } = classifySupplierHealth(s, disabledSupplierNames.has(supplier));
        return {
          id: supplier,
          supplier,
          queries: s.queries,
          success: s.success,
          failure: s.failure,
          products: s.products,
          parseErrors: s.parseErrors,
          status,
        };
      }),
    [aggregatedBySupplier, disabledSupplierNames],
  );

  const hasData = Object.keys(stats).length > 0;
  const hasRangedData = Object.keys(rangedStats).length > 0;
  const totalCalls = Object.values(aggregatedBySupplier).reduce(
    (sum, s) => sum + s.success + s.failure,
    0,
  );

  const innerRadius = 50;
  const middleRadius = 120;

  // Select the right pie data based on the toggle
  const activePie = pieView === "http" ? httpPieData : parsedPieData;
  const centerLabel = pieView === "http" ? i18n("stats_center_http") : i18n("stats_center_parsed");
  const activeTotalForTooltip =
    pieView === "http" ? httpPieData.totalCalls : parsedPieData.totalParsed;

  return (
    <div className={styles["stats-panel"]}>
      {/* Header */}
      <div className={styles["stats-panel__top-header"]}>
        <div className={styles["header-left"]}>
          {appContext?.setPanel && (
            <BackButton
              onClick={() => appContext.setPanel!(0)}
              size="small"
              aria-label={i18n("common_back_to_search")}
            >
              <ArrowBackIcon />
            </BackButton>
          )}
          <Typography variant="subtitle2">{i18n("stats_title")}</Typography>
        </div>
        <div className={styles["header-right"]}>
          <TextField
            select
            size="small"
            variant="standard"
            value={range}
            onChange={(event) => setRange(event.target.value as StatsRange)}
            aria-label={i18n("stats_range_label")}
            slotProps={{ input: { disableUnderline: true } }}
            sx={{ minWidth: 110, "& .MuiSelect-select": { fontSize: "0.75rem", py: 0.25 } }}
          >
            {STATS_RANGES.map(({ value, labelKey }) => (
              <MenuItem key={value} value={value} sx={{ fontSize: "0.75rem" }}>
                {i18n(labelKey)}
              </MenuItem>
            ))}
          </TextField>
          <Typography variant="caption" color="text.secondary">
            {totalCalls === 1
              ? i18n("stats_call_single", [String(totalCalls)])
              : i18n("stats_calls", [String(totalCalls)])}
          </Typography>
          {hasData && (
            <Tooltip title={i18n("stats_clear")}>
              <IconButton
                size="small"
                onClick={handleClear}
                className={styles["stats-panel__clear-btn"]}
              >
                <DeleteIcon className={styles["stats-panel__clear-icon"]} />
              </IconButton>
            </Tooltip>
          )}
        </div>
      </div>

      {!hasData ? (
        <Typography variant="body2" color="text.secondary" className={styles["stats-panel__empty"]}>
          {i18n("stats_empty")}
        </Typography>
      ) : (
        <>
          <Tabs
            value={activeTab}
            onChange={(_e, v) => setActiveTab(v)}
            variant="fullWidth"
            className={styles["stats-panel__tabs"]}
          >
            <Tab label={i18n("stats_tab_by_supplier")} />
            <Tab label={i18n("stats_tab_daily")} />
            <Tab label={i18n("stats_tab_totals")} />
          </Tabs>

          <Paper className={styles["stats-panel__content"]} elevation={2}>
            {/* A range with no recorded days would otherwise render empty charts. */}
            {!hasRangedData && (
              <Typography
                variant="body2"
                color="text.secondary"
                className={styles["stats-panel__empty"]}
              >
                {i18n("stats_empty_range")}
              </Typography>
            )}
            {/* Tab 0: Sunburst pie with toggle */}
            {hasRangedData && activeTab === 0 && (
              <>
                <Box className={styles["stats-panel__toggle-container"]}>
                  <ToggleButtonGroup
                    color="primary"
                    size="small"
                    value={pieView}
                    exclusive
                    onChange={(_e, v) => {
                      if (v !== null) setPieView(v);
                    }}
                  >
                    <ToggleButton value="http">{i18n("stats_toggle_http")}</ToggleButton>
                    <ToggleButton value="parsed">{i18n("stats_toggle_parsed")}</ToggleButton>
                  </ToggleButtonGroup>
                </Box>
                <Box className={styles["stats-panel__chart-container"]}>
                  <PieChart
                    series={[
                      {
                        innerRadius,
                        outerRadius: middleRadius,
                        data: activePie.inner.map((d) => ({ ...d, label: d.id })),
                        valueFormatter: ({ value }) =>
                          i18n("stats_pie_inner_tooltip", [
                            String(value),
                            String(activeTotalForTooltip),
                            String(
                              activeTotalForTooltip > 0
                                ? ((value / activeTotalForTooltip) * 100).toFixed(0)
                                : 0,
                            ),
                          ]),
                        highlightScope: { fade: "global", highlight: "item" },
                        highlighted: { additionalRadius: 2 },
                        cornerRadius: 3,
                        paddingAngle: 2,
                      },
                      {
                        innerRadius: middleRadius,
                        outerRadius: middleRadius + 20,
                        data: activePie.outer,
                        valueFormatter: (item) =>
                          // MUI's pie item type omits our custom PieDatum fields; the runtime
                          // data is the PieDatum[] we passed, so reading `percentage` is safe.
                          i18n("stats_pie_outer_tooltip", [
                            String(item.value),
                            String((item as unknown as PieDatum).percentage?.toFixed(0) ?? 0),
                          ]),
                        highlightScope: { fade: "global", highlight: "item" },
                        highlighted: { additionalRadius: 2 },
                        cornerRadius: 3,
                        paddingAngle: 1,
                      },
                    ]}
                    width={500}
                    height={300}
                    hideLegend
                  >
                    <PieCenterLabel>{centerLabel}</PieCenterLabel>
                  </PieChart>
                </Box>
                {/* Custom legend for supplier colors only */}
                <Box className={styles["stats-panel__legend"]}>
                  {activePie.inner.map((d) => (
                    <Box key={d.id} className={styles["stats-panel__legend-item"]}>
                      <Box
                        className={styles["stats-panel__legend-dot"]}
                        style={{ backgroundColor: d.color }}
                      />
                      <span>{d.id}</span>
                    </Box>
                  ))}
                </Box>
              </>
            )}

            {/* Tab 1: Line chart — daily calls per supplier */}
            {hasRangedData && activeTab === 1 && (
              <Box className={styles["stats-panel__chart-container"]}>
                {lineDates.length > 0 && lineSeries.length > 0 && (
                  <LineChart
                    xAxis={[{ scaleType: "point", data: lineDates }]}
                    series={lineSeries}
                    width={500}
                    height={320}
                    hideLegend
                  />
                )}
                {/* Custom legend */}
                <Box className={styles["stats-panel__legend"]}>
                  {lineSeries.map((s) => (
                    <Box key={s.label} className={styles["stats-panel__legend-item"]}>
                      <Box
                        className={styles["stats-panel__legend-dot"]}
                        style={{ backgroundColor: s.color }}
                      />
                      <span>{s.label}</span>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            {/* Tab 2: Totals table */}
            {hasRangedData && activeTab === 2 && (
              <div className={styles["stats-panel__table-container"]}>
                <DataGrid
                  rows={totalsRows}
                  columns={totalsColumns}
                  density="compact"
                  disableColumnMenu
                  hideFooter={totalsRows.length <= 25}
                  initialState={{
                    sorting: { sortModel: [{ field: "success", sort: "desc" }] },
                  }}
                  getRowClassName={({ row }) => `stats-row--${row.status}`}
                  sx={statusRowSx}
                  className={styles["stats-panel__table"]}
                />
              </div>
            )}
          </Paper>
        </>
      )}
    </div>
  );
};

export default StatsPanel;
