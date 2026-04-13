import { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Divider,
  Dialog, DialogActions, DialogContent, DialogTitle, IconButton, LinearProgress,
  Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Tooltip, Typography, useMediaQuery,
} from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import BalanceOutlinedIcon from "@mui/icons-material/BalanceOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import { useNavigate } from "react-router-dom";
import {
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Area, AreaChart, Line,
} from "recharts";

import { useTrip } from "../context/TripContext";
import { useTripSettings } from "../context/TripSettingsContext";
import { exportTripCsv } from "../api/trips";
import { getExpenses, deleteExpense, type Expense } from "../api/expenses";
import ExpenseEditDialog from "../components/ExpenseEditDialog";

function formatMoney(cents: number) {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });
}
function formatMoneyShort(cents: number) {
  const d = cents / 100;
  return d >= 1000 ? `$${(d / 1000).toFixed(1)}k` : `$${d.toFixed(0)}`;
}

const CHART_COLORS = [
  "#2AAE8C","#1F7A63","#A8D5BA","#7FBF9B",
  "#4ECDC4","#45B7D1","#96CEB4","#88D8B0",
  "#F7DC6F","#F0A500","#E67E22","#E74C3C",
];

function groupTotals(expenses: Expense[], keyFn: (e: Expense) => string) {
  const map = new Map<string, { cents: number; count: number }>();
  for (const e of expenses) {
    const key = (keyFn(e) || "Unknown").trim() || "Unknown";
    const cur = map.get(key) ?? { cents: 0, count: 0 };
    cur.cents += e.costCents ?? 0;
    cur.count += 1;
    map.set(key, cur);
  }
  return Array.from(map.entries())
    .map(([key, v]) => ({ key, cents: v.cents, count: v.count }))
    .sort((a, b) => b.cents - a.cents);
}

function buildTimeline(expenses: Expense[]) {
  const map = new Map<string, number>();
  for (const e of expenses) map.set(e.date, (map.get(e.date) ?? 0) + (e.costCents ?? 0));
  const sorted = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  let running = 0;
  return sorted.map(([date, cents]) => {
    running += cents;
    return { date, dailyCents: cents, cumulativeCents: running };
  });
}

function BudgetBar({ label, spentCents, limitCents, isTotal }: {
  label: string; spentCents: number; limitCents: number; isTotal?: boolean;
}) {
  const theme = useTheme();
  const pct = limitCents > 0 ? Math.min((spentCents / limitCents) * 100, 100) : 0;
  const over = spentCents > limitCents;
  const warn = pct >= 80 && !over;
  const barColor = over ? theme.palette.error.main : warn ? theme.palette.warning.main : theme.palette.primary.main;
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
        <Typography variant={isTotal ? "body1" : "body2"} fontWeight={isTotal ? 800 : 600}>{label}</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            {formatMoney(spentCents)} / {formatMoney(limitCents)}
          </Typography>
          {over && <Chip label={`+${formatMoney(spentCents - limitCents)}`} size="small" color="error" sx={{ height: 18, fontSize: 10, fontWeight: 700 }} />}
          {warn && <Chip label={`${Math.round(pct)}%`} size="small" color="warning" sx={{ height: 18, fontSize: 10, fontWeight: 700 }} />}
        </Stack>
      </Stack>
      <LinearProgress variant="determinate" value={pct} sx={{
        height: isTotal ? 10 : 6, borderRadius: 99,
        bgcolor: alpha(barColor, 0.15),
        "& .MuiLinearProgress-bar": { bgcolor: barColor, borderRadius: 99 },
      }} />
    </Box>
  );
}

export default function Summary() {
  const { trips, activeTripId, loadingTrips } = useTrip();
  const { getSettings, loadSettings } = useTripSettings();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const activeTripName = useMemo(
    () => trips.find((t) => t.tripId === activeTripId)?.name ?? "Trip",
    [trips, activeTripId]
  );
  const settings = activeTripId ? getSettings(activeTripId) : null;

  useEffect(() => {
    if (loadingTrips) return;
    if (!activeTripId) { setExpenses([]); setError(""); setLoading(false); return; }
    setLoading(true); setError("");
    getExpenses(activeTripId)
      .then((d) => setExpenses(d.expenses ?? []))
      .catch((e: any) => setError(e?.message ?? "Failed to load expenses"))
      .finally(() => setLoading(false));
    loadSettings(activeTripId);
  }, [activeTripId, loadingTrips]);

  const { totalCents, categoryTotals, recentExpenses, timelineData } = useMemo(() => {
    const total = expenses.reduce((s, e) => s + (e.costCents ?? 0), 0);
    const recent = [...expenses].sort((a, b) => {
      const ak = a.createdAt ?? `${a.date}T00:00:00.000Z`;
      const bk = b.createdAt ?? `${b.date}T00:00:00.000Z`;
      return bk.localeCompare(ak);
    });
    return {
      totalCents: total,
      categoryTotals: groupTotals(expenses, (e) => e.category),
      recentExpenses: recent.slice(0, 10),
      timelineData: buildTimeline(expenses),
    };
  }, [expenses]);

  const spentByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses) map.set(e.category, (map.get(e.category) ?? 0) + (e.costCents ?? 0));
    return map;
  }, [expenses]);

  const hasBudget = settings && (settings.totalBudgetCents !== null || settings.categoryBudgets.length > 0);

  const handleSaved = (updated: Expense) =>
    setExpenses((prev) => prev.map((e) => e.expenseId === updated.expenseId ? updated : e));

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true); setDeleteError(null);
    try {
      await deleteExpense(deleteTarget.expenseId);
      setExpenses((prev) => prev.filter((e) => e.expenseId !== deleteTarget.expenseId));
      setDeleteTarget(null);
    } catch (e: any) {
      setDeleteError(e?.message ?? "Failed to delete.");
    } finally {
      setDeleting(false);
    }
  };

  if (!loadingTrips && trips.length === 0) return (
    <Stack spacing={2}>
      <Typography variant="h5" fontWeight={800}>Summary</Typography>
      <Alert severity="info">Go to <b>Settings</b> to create your first trip.</Alert>
    </Stack>
  );
  if (!loadingTrips && !activeTripId) return (
    <Stack spacing={2}>
      <Typography variant="h5" fontWeight={800}>Summary</Typography>
      <Alert severity="info">Select a trip from the dropdown in the top bar.</Alert>
    </Stack>
  );

  return (
    <Box>
      <Stack spacing={2}>
        {/* Header */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
          <Typography variant="h5" fontWeight={800}>Summary — {activeTripName}</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Button variant="outlined" size="small" startIcon={<BalanceOutlinedIcon />} onClick={() => navigate("/settle-up")}>
              Settle Up
            </Button>
            <Button variant="outlined" size="small" startIcon={<SettingsOutlinedIcon />} onClick={() => navigate("/trip-settings")}>
              Trip Settings
            </Button>
            <Button variant="outlined" size="small" disabled={!activeTripId || loadingTrips || loading}
              onClick={() => activeTripId && exportTripCsv(activeTripId, activeTripName)}>
              Export CSV
            </Button>
          </Stack>
        </Stack>

        {error && <Alert severity="error">{error}</Alert>}
        {(loadingTrips || loading) && <Box sx={{ display: "grid", placeItems: "center", py: 4 }}><CircularProgress /></Box>}
        {!loadingTrips && !loading && !error && expenses.length === 0 && (
          <Alert severity="info">No expenses yet. Add one on the <b>Add Expense</b> page.</Alert>
        )}

        {!loadingTrips && !loading && !error && expenses.length > 0 && (
          <>
            {/* KPI cards */}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              {[
                { label: "Total Spend", value: formatMoney(totalCents) },
                { label: "Expenses", value: String(expenses.length) },
                { label: "Avg per Expense", value: formatMoney(expenses.length ? Math.round(totalCents / expenses.length) : 0) },
              ].map(({ label, value }) => (
                <Card key={label} sx={{ flex: 1 }}>
                  <CardContent>
                    <Typography variant="overline" sx={{ opacity: 0.75 }}>{label}</Typography>
                    <Typography variant="h4" fontWeight={900}>{value}</Typography>
                  </CardContent>
                </Card>
              ))}
            </Stack>

            {/* Budget */}
            {hasBudget && (
              <Card>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                    <Typography variant="h6" fontWeight={800}>Budget</Typography>
                    <Button size="small" onClick={() => navigate("/trip-settings")}>Edit</Button>
                  </Stack>
                  <Divider sx={{ mb: 2 }} />
                  <Stack spacing={1.5}>
                    {settings!.totalBudgetCents !== null && (
                      <BudgetBar label="Total Trip" spentCents={totalCents} limitCents={settings!.totalBudgetCents} isTotal />
                    )}
                    {settings!.categoryBudgets.length > 0 && settings!.totalBudgetCents !== null && <Divider />}
                    {settings!.categoryBudgets.map((cb) => (
                      <BudgetBar key={cb.category} label={cb.category}
                        spentCents={spentByCategory.get(cb.category) ?? 0} limitCents={cb.limitCents} />
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            )}

            {/* Charts: donut + bar */}
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <Card sx={{ flex: 1 }}>
                <CardContent>
                  <Typography variant="h6" fontWeight={800} sx={{ mb: 1.5 }}>Spend by Category</Typography>
                  <Divider sx={{ mb: 2 }} />
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={categoryTotals.map((r) => ({ name: r.key, value: r.cents }))}
                        cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2} dataKey="value">
                        {categoryTotals.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <RechartsTooltip formatter={(v: number) => [formatMoney(v), "Spent"]}
                        contentStyle={{ borderRadius: 8, border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                          background: theme.palette.background.paper, color: theme.palette.text.primary, fontSize: 12 }} />
                      <Legend iconType="circle" iconSize={8}
                        formatter={(v) => <span style={{ fontSize: 11, color: theme.palette.text.secondary }}>{v}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card sx={{ flex: 1 }}>
                <CardContent>
                  <Typography variant="h6" fontWeight={800} sx={{ mb: 1.5 }}>Category Breakdown</Typography>
                  <Divider sx={{ mb: 2 }} />
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={categoryTotals.slice(0, 8).map((r) => ({
                      name: r.key.length > 10 ? r.key.slice(0, 10) + "…" : r.key, cents: r.cents,
                    }))} margin={{ top: 4, right: 8, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.5)} vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: theme.palette.text.secondary }} angle={-30} textAnchor="end" interval={0} />
                      <YAxis tickFormatter={formatMoneyShort} tick={{ fontSize: 10, fill: theme.palette.text.secondary }} width={44} />
                      <RechartsTooltip formatter={(v: number) => [formatMoney(v), "Spent"]}
                        contentStyle={{ borderRadius: 8, border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                          background: theme.palette.background.paper, color: theme.palette.text.primary, fontSize: 12 }} />
                      <Bar dataKey="cents" radius={[4, 4, 0, 0]}>
                        {categoryTotals.slice(0, 8).map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Stack>

            {/* Spending over time */}
            {timelineData.length > 1 && (
              <Card>
                <CardContent>
                  <Typography variant="h6" fontWeight={800} sx={{ mb: 1.5 }}>Spending Over Time</Typography>
                  <Divider sx={{ mb: 2 }} />
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={timelineData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={theme.palette.primary.main} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.5)} vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: theme.palette.text.secondary }} interval="preserveStartEnd" />
                      <YAxis tickFormatter={formatMoneyShort} tick={{ fontSize: 10, fill: theme.palette.text.secondary }} width={44} />
                      <RechartsTooltip
                        formatter={(v: number, name: string) => [formatMoney(v), name === "cumulativeCents" ? "Total" : "Daily"]}
                        contentStyle={{ borderRadius: 8, border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                          background: theme.palette.background.paper, color: theme.palette.text.primary, fontSize: 12 }} />
                      <Area type="monotone" dataKey="cumulativeCents" stroke={theme.palette.primary.main}
                        strokeWidth={2} fill="url(#spendGrad)" dot={false} activeDot={{ r: 4 }} />
                      <Line type="monotone" dataKey="dailyCents"
                        stroke={alpha(theme.palette.primary.main, 0.45)} strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                  <Stack direction="row" spacing={2} sx={{ mt: 1, pl: 1 }}>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Box sx={{ width: 16, height: 2, bgcolor: "primary.main", borderRadius: 1 }} />
                      <Typography variant="caption" sx={{ opacity: 0.65 }}>Cumulative</Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Box sx={{ width: 16, height: 2, borderRadius: 1, bgcolor: alpha(theme.palette.primary.main, 0.45) }} />
                      <Typography variant="caption" sx={{ opacity: 0.65 }}>Daily</Typography>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            )}

            {/* Recent Expenses */}
            <Card>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                  <Typography variant="h6" fontWeight={800}>Recent Expenses</Typography>
                  <Button size="small" variant="outlined" onClick={() => navigate("/expenses/all")}>
                    View all {expenses.length} →
                  </Button>
                </Stack>
                <Divider sx={{ mb: 1.5 }} />
                {isMobile && (
                  <Typography variant="caption" sx={{ opacity: 0.6, display: "block", mb: 1 }}>
                    Swipe to see all columns →
                  </Typography>
                )}
                <TableContainer component={Paper} elevation={0} sx={{
                  bgcolor: "transparent", overflowX: isMobile ? "auto" : "visible", WebkitOverflowScrolling: "touch",
                }}>
                  <Table size="small" sx={{ minWidth: isMobile ? 760 : "auto" }}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Description</TableCell>
                        <TableCell>Category</TableCell>
                        <TableCell>Who Paid</TableCell>
                        <TableCell align="right">Cost</TableCell>
                        <TableCell align="center">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {recentExpenses.map((e) => (
                        <TableRow key={e.expenseId}
                          sx={{ "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.04) } }}>
                          <TableCell sx={{ whiteSpace: "nowrap" }}>{e.date}</TableCell>
                          <TableCell sx={{ minWidth: isMobile ? 160 : "auto" }}>{e.description}</TableCell>
                          <TableCell><Chip size="small" label={e.category} /></TableCell>
                          <TableCell sx={{ whiteSpace: "nowrap" }}>{e.whoPaid}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                            {formatMoney(e.costCents ?? 0)}
                          </TableCell>
                          <TableCell align="center">
                            <Stack direction="row" spacing={0.5} justifyContent="center">
                              <Tooltip title="Edit">
                                <IconButton size="small" onClick={() => { setEditExpense(e); setEditOpen(true); }}>
                                  <EditOutlinedIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <IconButton size="small" color="error"
                                  onClick={() => { setDeleteError(null); setDeleteTarget(e); }}>
                                  <DeleteOutlineIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </>
        )}
      </Stack>

      <ExpenseEditDialog expense={editExpense} open={editOpen} onClose={() => setEditOpen(false)} onSaved={handleSaved} />

      <Dialog open={!!deleteTarget} onClose={deleting ? undefined : () => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Delete expense?</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5}>
            <Alert severity="warning">
              <b>{deleteTarget?.description}</b> ({deleteTarget?.date}) will be permanently deleted.
            </Alert>
            {deleteError && <Alert severity="error">{deleteError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDeleteConfirm} disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} color="inherit" /> : <DeleteOutlineIcon />}>
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}