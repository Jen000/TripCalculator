import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { useNavigate } from "react-router-dom";

import { useTrip } from "../context/TripContext";
import { exportTripCsv } from "../api/trips";
import { getExpenses, deleteExpense, type Expense } from "../api/expenses";
import ExpenseEditDialog from "../components/ExpenseEditDialog";
import SettleUpCard from "../components/SettleUpCard";
import BudgetCard from "../components/BudgetCard";

function formatMoneyFromCents(cents: number) {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

type TotalsRow = { key: string; cents: number; count: number };

function groupTotals(expenses: Expense[], keyFn: (e: Expense) => string): TotalsRow[] {
  const map = new Map<string, { cents: number; count: number }>();
  for (const e of expenses) {
    const key = (keyFn(e) || "Unknown").trim() || "Unknown";
    const cost = Number.isFinite(e.costCents) ? e.costCents ?? 0 : 0;
    const cur = map.get(key) ?? { cents: 0, count: 0 };
    cur.cents += cost;
    cur.count += 1;
    map.set(key, cur);
  }
  return Array.from(map.entries())
    .map(([key, v]) => ({ key, cents: v.cents, count: v.count }))
    .sort((a, b) => b.cents - a.cents);
}

export default function Summary() {
  const { trips, activeTripId, loadingTrips } = useTrip();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expenses, setExpenses] = useState<Expense[]>([]);

  // Edit
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const activeTripName = useMemo(
    () => trips.find((t) => t.tripId === activeTripId)?.name ?? "Trip",
    [trips, activeTripId]
  );

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  useEffect(() => {
    if (loadingTrips) return;
    if (!activeTripId) {
      setExpenses([]);
      setError("");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    getExpenses(activeTripId)
      .then((data) => setExpenses(data.expenses ?? []))
      .catch((e: any) => setError(e?.message ?? "Failed to load expenses"))
      .finally(() => setLoading(false));
  }, [activeTripId, loadingTrips]);

  const { totalCents, categoryTotals, payerTotals, recentExpenses } = useMemo(() => {
    const total = expenses.reduce((sum, e) => sum + (e.costCents ?? 0), 0);
    const byCategory = groupTotals(expenses, (e) => e.category);
    const byPayer = groupTotals(expenses, (e) => e.whoPaid);
    const recent = [...expenses].sort((a, b) => {
      const ak = a.createdAt ?? `${a.date}T00:00:00.000Z`;
      const bk = b.createdAt ?? `${b.date}T00:00:00.000Z`;
      return bk.localeCompare(ak);
    });
    return {
      totalCents: total,
      categoryTotals: byCategory,
      payerTotals: byPayer,
      recentExpenses: recent.slice(0, 10),
    };
  }, [expenses]);

  const handleSaved = (updated: Expense) => {
    setExpenses((prev) => prev.map((e) => (e.expenseId === updated.expenseId ? updated : e)));
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteExpense(deleteTarget.expenseId);
      setExpenses((prev) => prev.filter((e) => e.expenseId !== deleteTarget.expenseId));
      setDeleteTarget(null);
    } catch (e: any) {
      setDeleteError(e?.message ?? "Failed to delete expense.");
    } finally {
      setDeleting(false);
    }
  };

  // ---------- Empty states ----------
  if (!loadingTrips && trips.length === 0) {
    return (
      <Stack spacing={2}>
        <Typography variant="h5" fontWeight={800}>Summary</Typography>
        <Alert severity="info">
          You don't have any trips yet. Go to <b>Settings</b> to create one.
        </Alert>
      </Stack>
    );
  }

  if (!loadingTrips && trips.length > 0 && !activeTripId) {
    return (
      <Stack spacing={2}>
        <Typography variant="h5" fontWeight={800}>Summary</Typography>
        <Alert severity="info">
          Select a trip from the dropdown in the top bar to see the summary.
        </Alert>
      </Stack>
    );
  }

  return (
    <Box>
      <Stack spacing={2}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
          <Typography variant="h5" fontWeight={800}>
            Summary — {activeTripName}
          </Typography>
          <Button
            variant="outlined"
            disabled={!activeTripId || loadingTrips || loading}
            onClick={() => activeTripId && exportTripCsv(activeTripId, activeTripName)}
          >
            Export CSV
          </Button>
        </Stack>

        {error && <Alert severity="error">{error}</Alert>}

        {(loadingTrips || loading) && (
          <Box sx={{ display: "grid", placeItems: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {!loadingTrips && !loading && !error && expenses.length === 0 && (
          <Alert severity="info">
            No expenses yet for this trip. Add one on the <b>Add Expense</b> page.
          </Alert>
        )}

        {!loadingTrips && !loading && !error && expenses.length > 0 && (
          <>
            {/* KPI cards */}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <Card sx={{ flex: 1 }}>
                <CardContent>
                  <Typography variant="overline" sx={{ opacity: 0.75 }}>Total Spend</Typography>
                  <Typography variant="h4" fontWeight={900}>{formatMoneyFromCents(totalCents)}</Typography>
                </CardContent>
              </Card>
              <Card sx={{ flex: 1 }}>
                <CardContent>
                  <Typography variant="overline" sx={{ opacity: 0.75 }}>Expense Count</Typography>
                  <Typography variant="h4" fontWeight={900}>{expenses.length}</Typography>
                </CardContent>
              </Card>
            </Stack>

            {/* Budget tracking */}
            {activeTripId && (
              <BudgetCard tripId={activeTripId} expenses={expenses} />
            )}

            {/* Settle Up */}
            <SettleUpCard expenses={expenses} />

            {/* Category / Payer breakdown tables */}
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <Card sx={{ flex: 1 }}>
                <CardContent>
                  <Typography variant="h6" fontWeight={800}>Spend by Category</Typography>
                  <Divider sx={{ my: 1.5 }} />
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Category</TableCell>
                        <TableCell align="right">Count</TableCell>
                        <TableCell align="right">Total</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {categoryTotals.map((row) => (
                        <TableRow key={row.key}>
                          <TableCell>{row.key}</TableCell>
                          <TableCell align="right">{row.count}</TableCell>
                          <TableCell align="right">{formatMoneyFromCents(row.cents)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card sx={{ flex: 1 }}>
                <CardContent>
                  <Typography variant="h6" fontWeight={800}>Spend by Who Paid</Typography>
                  <Divider sx={{ my: 1.5 }} />
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Person</TableCell>
                        <TableCell align="right">Count</TableCell>
                        <TableCell align="right">Total</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {payerTotals.map((row) => (
                        <TableRow key={row.key}>
                          <TableCell>{row.key}</TableCell>
                          <TableCell align="right">{row.count}</TableCell>
                          <TableCell align="right">{formatMoneyFromCents(row.cents)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </Stack>

            {/* Recent Expenses (last 10) */}
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
                  <Typography variant="caption" sx={{ opacity: 0.6 }}>
                    Swipe horizontally to see all columns →
                  </Typography>
                )}

                <TableContainer
                  component={Paper}
                  elevation={0}
                  sx={{
                    bgcolor: "transparent",
                    overflowX: isMobile ? "auto" : "visible",
                    WebkitOverflowScrolling: "touch",
                  }}
                >
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
                        <TableRow
                          key={e.expenseId}
                          sx={{ "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.04) } }}
                        >
                          <TableCell sx={{ whiteSpace: "nowrap" }}>{e.date}</TableCell>
                          <TableCell sx={{ minWidth: isMobile ? 180 : "auto" }}>{e.description}</TableCell>
                          <TableCell sx={{ whiteSpace: "nowrap" }}>
                            <Chip size="small" label={e.category} />
                          </TableCell>
                          <TableCell sx={{ whiteSpace: "nowrap" }}>{e.whoPaid}</TableCell>
                          <TableCell align="right" sx={{ whiteSpace: "nowrap", fontWeight: 600 }}>
                            {formatMoneyFromCents(e.costCents ?? 0)}
                          </TableCell>
                          <TableCell align="center">
                            <Stack direction="row" spacing={0.5} justifyContent="center">
                              <Tooltip title="Edit">
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    setEditExpense(e);
                                    setEditOpen(true);
                                  }}
                                >
                                  <EditOutlinedIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => {
                                    setDeleteError(null);
                                    setDeleteTarget(e);
                                  }}
                                >
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

      {/* Edit dialog */}
      <ExpenseEditDialog
        expense={editExpense}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={handleSaved}
      />

      {/* Delete confirmation */}
      <Dialog
        open={!!deleteTarget}
        onClose={deleting ? undefined : () => setDeleteTarget(null)}
        maxWidth="xs"
        fullWidth
      >
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
          <Button
            color="error"
            variant="contained"
            onClick={handleDeleteConfirm}
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} color="inherit" /> : <DeleteOutlineIcon />}
          >
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}