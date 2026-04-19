import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Avatar,
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
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";

import { useTrip } from "../context/TripContext";
import { getExpenses, type Expense } from "../api/expenses";
import { getPayments, recordPayment, deletePayment, type Payment } from "../api/tripSettings";

function formatMoney(cents: number) {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

type Transfer = { from: string; to: string; owedCents: number; paidCents: number; remainingCents: number };

function computeTransfers(expenses: Expense[], payments: Payment[]): {
  perPerson: { name: string; paidCents: number; shareCents: number; netCents: number }[];
  transfers: Transfer[];
} {
  if (expenses.length === 0) return { perPerson: [], transfers: [] };

  const paidMap = new Map<string, number>();
  for (const e of expenses) {
    const key = (e.whoPaid || "Unknown").trim();
    paidMap.set(key, (paidMap.get(key) ?? 0) + (e.costCents ?? 0));
  }

  const people = Array.from(paidMap.keys());
  const totalCents = Array.from(paidMap.values()).reduce((a, b) => a + b, 0);
  const n = people.length;
  if (n === 0) return { perPerson: [], transfers: [] };

  const shareCents = Math.round(totalCents / n);
  const perPerson = people.map((name) => {
    const paid = paidMap.get(name) ?? 0;
    return { name, paidCents: paid, shareCents, netCents: paid - shareCents };
  });

  // Greedy minimum-transfer algorithm
  const balances = new Map(perPerson.map((p) => [p.name, p.netCents]));
  const rawTransfers: { from: string; to: string; cents: number }[] = [];

  let safety = 0;
  while (safety++ < 1000) {
    const creditors = Array.from(balances.entries()).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const debtors = Array.from(balances.entries()).filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1]);
    if (!creditors.length || !debtors.length) break;
    const [creditor, creditAmt] = creditors[0];
    const [debtor, debtAmt] = debtors[0];
    const amount = Math.min(creditAmt, -debtAmt);
    if (amount <= 0) break;
    rawTransfers.push({ from: debtor, to: creditor, cents: amount });
    balances.set(creditor, creditAmt - amount);
    balances.set(debtor, debtAmt + amount);
  }

  // Merge payments into transfers
  const transfers: Transfer[] = rawTransfers.map((t) => {
    const paidCents = payments
      .filter((p) => p.fromUser === t.from && p.toUser === t.to)
      .reduce((sum, p) => sum + p.amountCents, 0);
    return {
      from: t.from,
      to: t.to,
      owedCents: t.cents,
      paidCents,
      remainingCents: Math.max(0, t.cents - paidCents),
    };
  });

  return { perPerson, transfers };
}

export default function SettleUpPage() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { trips, activeTripId, loadingTrips } = useTrip();

  const activeTripName = useMemo(
    () => trips.find((t) => t.tripId === activeTripId)?.name ?? "Trip",
    [trips, activeTripId]
  );

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Record payment dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogFrom, setDialogFrom] = useState("");
  const [dialogTo, setDialogTo] = useState("");
  const [dialogAmount, setDialogAmount] = useState("");
  const [dialogNote, setDialogNote] = useState("");
  const [dialogSaving, setDialogSaving] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  // Delete payment
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);

  useEffect(() => {
    if (loadingTrips || !activeTripId) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      getExpenses(activeTripId).then((d) => setExpenses(d.expenses ?? [])),
      getPayments(activeTripId)
        .then((d) => setPayments(d.payments ?? []))
        .catch(() => setPayments([])), // backend not wired yet
    ])
      .catch((e: any) => setError(e?.message ?? "Failed to load data"))
      .finally(() => setLoading(false));
  }, [activeTripId, loadingTrips]);

  const { perPerson, transfers } = useMemo(
    () => computeTransfers(expenses, payments),
    [expenses, payments]
  );

  const allSettled = transfers.every((t) => t.remainingCents <= 0);

  const openRecordDialog = (from: string, to: string, remainingCents: number) => {
    setDialogFrom(from);
    setDialogTo(to);
    setDialogAmount((remainingCents / 100).toFixed(2));
    setDialogNote("");
    setDialogError(null);
    setDialogOpen(true);
  };

  const handleRecordPayment = async () => {
    if (!activeTripId) return;
    const amount = Number(dialogAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setDialogError("Please enter a valid amount.");
      return;
    }
    setDialogSaving(true);
    setDialogError(null);
    try {
      const result = await recordPayment(activeTripId, {
        fromUser: dialogFrom,
        toUser: dialogTo,
        amountCents: Math.round(amount * 100),
        note: dialogNote.trim() || undefined,
      });
      setPayments((prev) => [...prev, result.payment]);
      setDialogOpen(false);
    } catch (e: any) {
      // Backend not wired yet — store locally
      const localPayment: Payment = {
        paymentId: `local-${Date.now()}`,
        tripId: activeTripId,
        fromUser: dialogFrom,
        toUser: dialogTo,
        amountCents: Math.round(amount * 100),
        note: dialogNote.trim() || undefined,
        createdAt: new Date().toISOString(),
      };
      setPayments((prev) => [...prev, localPayment]);
      setDialogOpen(false);
    } finally {
      setDialogSaving(false);
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!activeTripId) return;
    setDeletingPaymentId(paymentId);
    try {
      await deletePayment(activeTripId, paymentId);
    } catch {
      // Backend not wired — just remove locally
    } finally {
      setPayments((prev) => prev.filter((p) => p.paymentId !== paymentId));
      setDeletingPaymentId(null);
    }
  };

  if (!loadingTrips && !activeTripId) {
    return (
      <Stack spacing={2}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/")} sx={{ alignSelf: "flex-start" }}>
          Back
        </Button>
        <Alert severity="info">Select a trip from the top bar first.</Alert>
      </Stack>
    );
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/")} size="small">
          Summary
        </Button>
        <Typography variant="h5" fontWeight={800} sx={{ flex: 1 }}>
          Settle Up — {activeTripName}
        </Typography>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

      {loading || loadingTrips ? (
        <Box sx={{ display: "grid", placeItems: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : expenses.length === 0 ? (
        <Alert severity="info">No expenses yet — nothing to settle up.</Alert>
      ) : (
        <>
          {/* ── Per-person summary ── */}
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={800} sx={{ mb: 1.5 }}>
                Who Paid What
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Stack spacing={1.5}>
                {perPerson.sort((a, b) => b.paidCents - a.paidCents).map((p) => {
                  const isOwed = p.netCents > 0;
                  const isOwes = p.netCents < 0;
                  return (
                    <Stack key={p.name} direction="row" alignItems="center" spacing={1.5}>
                      <Avatar
                        sx={{
                          width: 36, height: 36, fontSize: 13, fontWeight: 800,
                          bgcolor: alpha(theme.palette.primary.main, 0.15),
                          color: theme.palette.primary.main,
                        }}
                      >
                        {initials(p.name)}
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" fontWeight={700}>{p.name}</Typography>
                        <Typography variant="caption" sx={{ opacity: 0.65 }}>
                          Paid {formatMoney(p.paidCents)} · Fair share {formatMoney(p.shareCents)}
                        </Typography>
                      </Box>
                      {isOwed && (
                        <Chip label={`gets back ${formatMoney(p.netCents)}`} size="small" color="success"
                          sx={{ fontWeight: 700 }} />
                      )}
                      {isOwes && (
                        <Chip label={`owes ${formatMoney(-p.netCents)}`} size="small" color="error"
                          sx={{ fontWeight: 700 }} />
                      )}
                      {!isOwed && !isOwes && (
                        <Chip label="even" size="small" sx={{ fontWeight: 700 }} />
                      )}
                    </Stack>
                  );
                })}
              </Stack>
            </CardContent>
          </Card>

          {/* ── Transfers & ledger ── */}
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={800} sx={{ mb: 0.5 }}>
                Transfers & Ledger
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.65, mb: 1.5 }}>
                Minimum transfers to settle the trip. Record payments as they happen.
              </Typography>
              <Divider sx={{ mb: 2 }} />

              {allSettled ? (
                <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 1 }}>
                  <CheckCircleOutlineIcon color="success" />
                  <Typography variant="body1" color="success.main" fontWeight={700}>
                    All settled — everyone is even!
                  </Typography>
                </Stack>
              ) : (
                <Stack spacing={2}>
                  {transfers.map((t, i) => {
                    const settled = t.remainingCents <= 0;
                    const relevantPayments = payments.filter(
                      (p) => p.fromUser === t.from && p.toUser === t.to
                    );
                    return (
                      <Box
                        key={i}
                        sx={{
                          borderRadius: 3,
                          border: `1px solid ${alpha(
                            settled ? theme.palette.success.main : theme.palette.error.main, 0.2
                          )}`,
                          bgcolor: alpha(
                            settled ? theme.palette.success.main : theme.palette.error.main, 0.04
                          ),
                          overflow: "hidden",
                        }}
                      >
                        {/* Transfer header */}
                        <Stack
                          direction="row"
                          alignItems="center"
                          spacing={1}
                          sx={{ px: 2, py: 1.5 }}
                        >
                          <Avatar sx={{ width: 30, height: 30, fontSize: 11, fontWeight: 800,
                            bgcolor: alpha(theme.palette.error.main, 0.15), color: theme.palette.error.main }}>
                            {initials(t.from)}
                          </Avatar>
                          <Typography variant="body2" fontWeight={800} color="error.main">
                            {t.from}
                          </Typography>
                          <ArrowForwardIcon fontSize="small" sx={{ opacity: 0.45 }} />
                          <Avatar sx={{ width: 30, height: 30, fontSize: 11, fontWeight: 800,
                            bgcolor: alpha(theme.palette.success.main, 0.15), color: theme.palette.success.main }}>
                            {initials(t.to)}
                          </Avatar>
                          <Typography variant="body2" fontWeight={800}>
                            {t.to}
                          </Typography>
                          <Box sx={{ flex: 1 }} />
                          <Stack alignItems="flex-end">
                            <Typography variant="body2" fontWeight={800}>
                              {formatMoney(t.owedCents)} total
                            </Typography>
                            {t.paidCents > 0 && (
                              <Typography variant="caption" color="success.main" fontWeight={600}>
                                {formatMoney(t.paidCents)} paid
                              </Typography>
                            )}
                            {!settled && (
                              <Typography variant="caption" color="error.main" fontWeight={700}>
                                {formatMoney(t.remainingCents)} remaining
                              </Typography>
                            )}
                            {settled && (
                              <Chip label="Settled ✓" size="small" color="success"
                                sx={{ height: 18, fontSize: 10, fontWeight: 800 }} />
                            )}
                          </Stack>
                        </Stack>

                        {/* Payment log */}
                        {relevantPayments.length > 0 && (
                          <>
                            <Divider />
                            <Stack spacing={0} sx={{ px: 2, py: 1 }}>
                              {relevantPayments.map((p) => (
                                <Stack
                                  key={p.paymentId}
                                  direction="row"
                                  alignItems="center"
                                  spacing={1}
                                  sx={{ py: 0.5 }}
                                >
                                  <Typography variant="caption" sx={{ opacity: 0.55, minWidth: 80 }}>
                                    {new Date(p.createdAt).toLocaleDateString()}
                                  </Typography>
                                  <Typography variant="caption" fontWeight={600}>
                                    {formatMoney(p.amountCents)} paid
                                  </Typography>
                                  {p.note && (
                                    <Typography variant="caption" sx={{ opacity: 0.6 }}>
                                      · {p.note}
                                    </Typography>
                                  )}
                                  <Box sx={{ flex: 1 }} />
                                  <Tooltip title="Remove payment">
                                    <IconButton
                                      size="small"
                                      onClick={() => handleDeletePayment(p.paymentId)}
                                      disabled={deletingPaymentId === p.paymentId}
                                    >
                                      {deletingPaymentId === p.paymentId
                                        ? <CircularProgress size={12} />
                                        : <DeleteOutlineIcon sx={{ fontSize: 14 }} />}
                                    </IconButton>
                                  </Tooltip>
                                </Stack>
                              ))}
                            </Stack>
                          </>
                        )}

                        {/* Record payment button */}
                        {!settled && (
                          <>
                            <Divider />
                            <Box sx={{ px: 2, py: 1 }}>
                              <Button
                                size="small"
                                startIcon={<AddCircleOutlineIcon />}
                                onClick={() => openRecordDialog(t.from, t.to, t.remainingCents)}
                              >
                                Record a payment
                              </Button>
                            </Box>
                          </>
                        )}
                      </Box>
                    );
                  })}
                </Stack>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Record payment dialog */}
      <Dialog open={dialogOpen} onClose={dialogSaving ? undefined : () => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Record a Payment</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {dialogError && <Alert severity="error">{dialogError}</Alert>}
            <Typography variant="body2">
              <b>{dialogFrom}</b> pays <b>{dialogTo}</b>
            </Typography>
            <TextField
              label="Amount"
              value={dialogAmount}
              onChange={(e) => setDialogAmount(e.target.value)}
              type="number"
              inputProps={{ min: 0, step: "0.01" }}
              fullWidth
              disabled={dialogSaving}
              InputProps={{ startAdornment: <Typography sx={{ mr: 0.5, opacity: 0.6 }}>$</Typography> }}
            />
            <TextField
              label="Note (optional)"
              value={dialogNote}
              onChange={(e) => setDialogNote(e.target.value)}
              fullWidth
              disabled={dialogSaving}
              placeholder="e.g. Venmo, cash, etc."
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={dialogSaving}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleRecordPayment}
            disabled={dialogSaving || !dialogAmount}
          >
            {dialogSaving ? <CircularProgress size={18} color="inherit" /> : "Record"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}