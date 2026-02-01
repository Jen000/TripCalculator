import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Stack,
  Alert,
  CircularProgress,
  Divider,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
} from "@mui/material";

import { useTrip } from "../context/TripContext";
import { exportTripCsv } from "../api/trips";
import { getExpenses, type Expense } from "../api/expenses";

function formatMoneyFromCents(cents: number) {
  return (cents / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

type TotalsRow = { key: string; cents: number; count: number };

function groupTotals(expenses: Expense[], keyFn: (e: Expense) => string): TotalsRow[] {
  const map = new Map<string, { cents: number; count: number }>();

  for (const e of expenses) {
    const key = (keyFn(e) || "Unknown").trim() || "Unknown";
    const cost = Number.isFinite(e.costCents) ? (e.costCents ?? 0) : 0;

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

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const activeTripName = useMemo(() => {
    return trips.find((t) => t.tripId === activeTripId)?.name ?? "Trip";
  }, [trips, activeTripId]);

  useEffect(() => {
    // Wait for trips to finish loading
    if (loadingTrips) return;

    // If no selected trip, clear expenses view
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
      const aKey = a.createdAt ?? `${a.date}T00:00:00.000Z`;
      const bKey = b.createdAt ?? `${b.date}T00:00:00.000Z`;
      return bKey.localeCompare(aKey);
    });

    return {
      totalCents: total,
      categoryTotals: byCategory,
      payerTotals: byPayer,
      recentExpenses: recent.slice(0, 10),
    };
  }, [expenses]);

  // ---------- Empty states ----------
  if (!loadingTrips && trips.length === 0) {
    return (
      <Stack spacing={2}>
        <Typography variant="h5" fontWeight={800}>
          Summary
        </Typography>
        <Alert severity="info">
          You don’t have any trips yet. Go to <b>Settings</b> to create one, then come back here.
        </Alert>
      </Stack>
    );
  }

  if (!loadingTrips && trips.length > 0 && !activeTripId) {
    return (
      <Stack spacing={2}>
        <Typography variant="h5" fontWeight={800}>
          Summary
        </Typography>
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
                  <Typography variant="overline" sx={{ opacity: 0.75 }}>
                    Total Spend
                  </Typography>
                  <Typography variant="h4" fontWeight={900}>
                    {formatMoneyFromCents(totalCents)}
                  </Typography>
                </CardContent>
              </Card>

              <Card sx={{ flex: 1 }}>
                <CardContent>
                  <Typography variant="overline" sx={{ opacity: 0.75 }}>
                    Expense Count
                  </Typography>
                  <Typography variant="h4" fontWeight={900}>
                    {expenses.length}
                  </Typography>
                </CardContent>
              </Card>
            </Stack>

            {/* Tables */}
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <Card sx={{ flex: 1 }}>
                <CardContent>
                  <Typography variant="h6" fontWeight={800}>
                    Spend by Category
                  </Typography>
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
                  <Typography variant="h6" fontWeight={800}>
                    Spend by Who Paid
                  </Typography>
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

            {/* Recent expenses */}
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={800}>
                  Recent Expenses
                </Typography>
                <Divider sx={{ my: 1.5 }} />

                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell>Category</TableCell>
                      <TableCell>Who Paid</TableCell>
                      <TableCell align="right">Cost</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recentExpenses.map((e) => (
                      <TableRow key={e.expenseId}>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>{e.date}</TableCell>
                        <TableCell>{e.description}</TableCell>
                        <TableCell>
                          <Chip size="small" label={e.category} />
                        </TableCell>
                        <TableCell>{e.whoPaid}</TableCell>
                        <TableCell align="right">{formatMoneyFromCents(e.costCents ?? 0)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </Stack>
    </Box>
  );
}
