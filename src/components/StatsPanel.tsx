import { Delete as DeleteIcon } from "@mui/icons-material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Box, IconButton, Paper, Tab, Tabs, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from "@mui/material";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { styled } from "@mui/material/styles";
import { LineChart } from "@mui/x-charts/LineChart";
import { PieChart } from "@mui/x-charts/PieChart";
import { useDrawingArea } from "@mui/x-charts/hooks";
import { useEffect, useMemo, useState } from "react";
import { useAppContext } from "@/context";
import { clearStats, getStats } from "@/utils/SupplierStatsStore";
import { BackButton, HeaderRight } from "./StyledComponents";
import "./StatsPanel.scss";

/** Color palette for suppliers */
const SUPPLIER_COLORS = [
  "#fa938e", "#98bf45", "#51cbcf", "#d397ff", "#ffc658",
  "#8884d8", "#82ca9d", "#8dd1e1", "#a4de6c", "#ffa07a",
  "#87ceeb", "#f0e68c",
];

/** Convert hex to rgba */
const hexToRgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/** Center label for the pie chart */
const StyledText = styled("text")(({ theme }) => ({
  fill: theme.palette.text.primary,
  textAnchor: "middle",
  dominantBaseline: "central",
  fontSize: 16,
  fontWeight: 500,
}));

function PieCenterLabel({ children }: { children: React.ReactNode }) {
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
 */
const StatsPanel: React.FC = () => {
  const appContext = useAppContext();
  const [stats, setStats] = useState<SupplierStatsData>({});
  const [activeTab, setActiveTab] = useState(0);
  const [pieView, setPieView] = useState<PieView>("http");

  useEffect(() => {
    getStats().then(setStats).catch(console.warn);
    // Re-read stats when any supplier_stats_* key changes (live updates during search)
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      const hasStatsChange = Object.keys(changes).some((k) => k.startsWith("supplier_stats_"));
      if (hasStatsChange) {
        getStats().then(setStats).catch(console.warn);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const handleClear = () => {
    clearStats().then(() => setStats({})).catch(console.warn);
  };

  // Aggregate stats across all days
  const aggregatedBySupplier = useMemo(() => {
    const agg: Record<string, { success: number; failure: number; products: number; queries: number; parseErrors: number }> = {};
    for (const dayStats of Object.values(stats)) {
      for (const [supplier, s] of Object.entries(dayStats)) {
        if (!agg[supplier]) agg[supplier] = { success: 0, failure: 0, products: 0, queries: 0, parseErrors: 0 };
        agg[supplier].success += s.successCount;
        agg[supplier].failure += s.failureCount;
        agg[supplier].products += s.uniqueProductCount;
        agg[supplier].queries += s.searchQueryCount ?? 0;
        agg[supplier].parseErrors += s.parseErrorCount ?? 0;
      }
    }
    return agg;
  }, [stats]);

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
    const totalCalls = suppliers.reduce((sum, s) => sum + aggregatedBySupplier[s].success + aggregatedBySupplier[s].failure, 0);

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
          label: "Successes",
          value: success,
          percentage: supplierTotal > 0 ? (success / supplierTotal) * 100 : 0,
          color: baseColor,
        },
        {
          id: `${supplier}-failure`,
          label: "Fails",
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
    const totalParsed = suppliers.reduce((sum, s) => sum + aggregatedBySupplier[s].products + aggregatedBySupplier[s].parseErrors, 0);

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
          label: "Successes",
          value: products,
          percentage: supplierTotal > 0 ? (products / supplierTotal) * 100 : 0,
          color: baseColor,
        },
        {
          id: `${supplier}-parseError`,
          label: "Fails",
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
    const sortedDates = Object.keys(stats).sort();

    const allSuppliers = new Set<string>();
    for (const dayStats of Object.values(stats)) {
      for (const supplier of Object.keys(dayStats)) {
        allSuppliers.add(supplier);
      }
    }

    const series: Array<{ data: number[]; label: string; color: string; showMark: boolean; valueFormatter: (v: number | null) => string }> = [];
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
        valueFormatter: (v) => {
          if (!v) return "0 calls";
          return `${v} calls`;
        },
      });
      colorIdx++;
    }

    return { lineSeries: series, lineDates: sortedDates.map((d) => d.slice(5)) };
  }, [stats]);

  // Totals table
  const totalsColumns: GridColDef[] = [
    { field: "supplier", headerName: "Supplier", flex: 1, minWidth: 130 },
    { field: "queries", headerName: "Queries", width: 80, type: "number" },
    { field: "success", headerName: "Success", width: 80, type: "number" },
    { field: "failure", headerName: "Failure", width: 80, type: "number" },
    { field: "products", headerName: "Products", width: 85, type: "number" },
    { field: "parseErrors", headerName: "Parse Errors", width: 105, type: "number" },
  ];

  const totalsRows = useMemo(() =>
    Object.entries(aggregatedBySupplier).map(([supplier, s]) => ({
      id: supplier,
      supplier,
      queries: s.queries,
      success: s.success,
      failure: s.failure,
      products: s.products,
      parseErrors: s.parseErrors,
    })),
  [aggregatedBySupplier]);

  const hasData = Object.keys(stats).length > 0;
  const totalCalls = Object.values(aggregatedBySupplier).reduce((sum, s) => sum + s.success + s.failure, 0);

  const innerRadius = 50;
  const middleRadius = 120;

  // Select the right pie data based on the toggle
  const activePie = pieView === "http" ? httpPieData : parsedPieData;
  const centerLabel = pieView === "http" ? "HTTP" : "Parsed";
  const activeTotalForTooltip = pieView === "http" ? httpPieData.totalCalls : parsedPieData.totalParsed;

  return (
    <div className="stats-panel">
      {/* Header */}
      <div className="stats-panel__top-header">
        <div className="header-left">
          {appContext?.setPanel && (
            <BackButton
              onClick={() => appContext.setPanel!(0)}
              size="small"
              aria-label="Back to search home"
            >
              <ArrowBackIcon />
            </BackButton>
          )}
          <Typography variant="subtitle2">Supplier Stats</Typography>
        </div>
        <HeaderRight>
          <Typography variant="caption" color="text.secondary">
            {totalCalls} call{totalCalls !== 1 ? "s" : ""}
          </Typography>
          {hasData && (
            <Tooltip title="Clear stats">
              <IconButton size="small" onClick={handleClear} className="stats-panel__clear-btn">
                <DeleteIcon className="stats-panel__clear-icon" />
              </IconButton>
            </Tooltip>
          )}
        </HeaderRight>
      </div>

      {!hasData ? (
        <Typography variant="body2" color="text.secondary" className="stats-panel__empty">
          No stats yet. Run a search to start tracking.
        </Typography>
      ) : (
        <>
          <Tabs
            value={activeTab}
            onChange={(_e, v) => setActiveTab(v)}
            variant="fullWidth"
            className="stats-panel__tabs"
          >
            <Tab label="By Supplier" />
            <Tab label="Daily" />
            <Tab label="Totals" />
          </Tabs>

          <Paper className="stats-panel__content" elevation={2}>
            {/* Tab 0: Sunburst pie with toggle */}
            {activeTab === 0 && (
              <>
                <Box className="stats-panel__toggle-container">
                  <ToggleButtonGroup
                    color="primary"
                    size="small"
                    value={pieView}
                    exclusive
                    onChange={(_e, v) => { if (v !== null) setPieView(v); }}
                  >
                    <ToggleButton value="http">HTTP Calls</ToggleButton>
                    <ToggleButton value="parsed">Parsed Data</ToggleButton>
                  </ToggleButtonGroup>
                </Box>
                <Box className="stats-panel__chart-container">
                  <PieChart
                    series={[
                      {
                        innerRadius,
                        outerRadius: middleRadius,
                        data: activePie.inner.map((d) => ({ ...d, label: d.id })),
                        valueFormatter: ({ value }) =>
                          `${value} of ${activeTotalForTooltip} (${activeTotalForTooltip > 0 ? ((value / activeTotalForTooltip) * 100).toFixed(0) : 0}%)`,
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
                          `${item.value} (${((item as any).percentage ?? 0).toFixed(0)}%)`,
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
                <Box className="stats-panel__legend">
                  {activePie.inner.map((d) => (
                    <Box key={d.id} className="stats-panel__legend-item">
                      <Box className="stats-panel__legend-dot" style={{ backgroundColor: d.color }} />
                      <span>{d.id}</span>
                    </Box>
                  ))}
                </Box>
              </>
            )}

            {/* Tab 1: Line chart — daily calls per supplier */}
            {activeTab === 1 && (
              <Box className="stats-panel__chart-container">
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
                <Box className="stats-panel__legend">
                  {lineSeries.map((s) => (
                    <Box key={s.label} className="stats-panel__legend-item">
                      <Box className="stats-panel__legend-dot" style={{ backgroundColor: s.color }} />
                      <span>{s.label}</span>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            {/* Tab 2: Totals table */}
            {activeTab === 2 && (
              <div className="stats-panel__table-container">
                <DataGrid
                  rows={totalsRows}
                  columns={totalsColumns}
                  density="compact"
                  disableColumnMenu
                  hideFooter={totalsRows.length <= 25}
                  initialState={{
                    sorting: { sortModel: [{ field: "success", sort: "desc" }] },
                  }}
                  className="stats-panel__table"
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
