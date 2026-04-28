import { useEffect, useMemo, useState } from "react";
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle, Divider, IconButton,
  Stack, TextField, Tooltip, Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";

import { useTrip } from "../context/TripContext";
import { useUser } from "../context/UserContext";
import { getExpenses, type Expense } from "../api/expenses";
import { getPayments, recordPayment, deletePayment, type Payment } from "../api/tripSettings";

function formatMoney(cents: number) {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

type Transfer = {
  from: string; to: string;
  owedCents: number; paidCents: number; remainingCents: number;
};

function computeSettleUp(expenses: Expense[], payments: Payment[]) {
  if (expenses.length === 0) return { perPerson: [], transfers: [], totalCents: 0 };

  const paidMap = new Map<string, number>();
  for (const e of expenses) {
    const key = (e.whoPaid || "Unknown").trim();
    paidMap.set(key, (paidMap.get(key) ?? 0) + (e.costCents ?? 0));
  }

  const people = Array.from(paidMap.keys());
  const totalCents = Array.from(paidMap.values()).reduce((a, b) => a + b, 0);
  const n = people.length;
  if (n === 0) return { perPerson: [], transfers: [], totalCents: 0 };

  const shareCents = Math.round(totalCents / n);
  const perPerson = people.map((name) => {
    const paid = paidMap.get(name) ?? 0;
    return { name, paidCents: paid, shareCents, netCents: paid - shareCents };
  });

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

  const transfers: Transfer[] = rawTransfers.map((t) => {
    const paidCents = payments
      .filter((p) => p.fromUser === t.from && p.toUser === t.to)
      .reduce((sum, p) => sum + p.amountCents, 0);
    return { from: t.from, to: t.to, owedCents: t.cents, paidCents, remainingCents: Math.max(0, t.cents - paidCents) };
  });

  return { perPerson, transfers, totalCents };
}

export default function SettleUpPage() {
  const theme = useTheme();
  const { trips, activeTripId, loadingTrips } = useTrip();
  const { profile } = useUser();

  const activeTripName = useMemo(
    () => trips.find((t) => t.tripId === activeTripId)?.name ?? "Trip",
    [trips, activeTripId]
  );

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogFrom, setDialogFrom] = useState("");
  const [dialogTo, setDialogTo] = useState("");
  const [dialogAmount, setDialogAmount] = useState("");
  const [dialogNote, setDialogNote] = useState("");
  const [dialogSaving, setDialogSaving] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);

  useEffect(() => {
    if (loadingTrips || !activeTripId) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      getExpenses(activeTripId).then((d) => setExpenses(d.expenses ?? [])),
      getPayments(activeTripId).then((d) => setPayments(d.payments ?? [])).catch(() => setPayments([])),
    ])
      .catch((e: any) => setError(e?.message ?? "Failed to load data"))
      .finally(() => setLoading(false));
  }, [activeTripId, loadingTrips]);

  const { perPerson, transfers, totalCents } = useMemo(
    () => computeSettleUp(expenses, payments), [expenses, payments]
  );

  const myName = profile?.firstName ?? null;
  const myOwes = myName ? transfers.filter((t) => t.from.toLowerCase() === myName.toLowerCase() && t.remainingCents > 0) : [];
  const myOwed = myName ? transfers.filter((t) => t.to.toLowerCase() === myName.toLowerCase() && t.remainingCents > 0) : [];
  const iAllSettled = myOwes.length === 0 && myOwed.length === 0;
  const allSettled = transfers.every((t) => t.remainingCents <= 0);

  const openRecordDialog = (from: string, to: string, remainingCents: number) => {
    setDialogFrom(from); setDialogTo(to);
    setDialogAmount((remainingCents / 100).toFixed(2));
    setDialogNote(""); setDialogError(null); setDialogOpen(true);
  };

  const handleRecordPayment = async () => {
    if (!activeTripId) return;
    const amount = Number(dialogAmount);
    if (!Number.isFinite(amount) || amount <= 0) { setDialogError("Please enter a valid amount."); return; }
    setDialogSaving(true); setDialogError(null);
    try {
      const result = await recordPayment(activeTripId, {
        fromUser: dialogFrom, toUser: dialogTo,
        amountCents: Math.round(amount * 100), note: dialogNote.trim() || undefined,
      });
      setPayments((prev) => [...prev, result.payment]);
      setDialogOpen(false);
    } catch {
      const local: Payment = {
        paymentId: `local-${Date.now()}`, tripId: activeTripId,
        fromUser: dialogFrom, toUser: dialogTo,
        amountCents: Math.round(amount * 100),
        note: dialogNote.trim() || undefined,
        createdAt: new Date().toISOString(),
      };
      setPayments((prev) => [...prev, local]);
      setDialogOpen(false);
    } finally { setDialogSaving(false); }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!activeTripId) return;
    setDeletingPaymentId(paymentId);
    try { await deletePayment(activeTripId, paymentId); } catch { /* local fallback */ }
    finally {
      setPayments((prev) => prev.filter((p) => p.paymentId !== paymentId));
      setDeletingPaymentId(null);
    }
  };

  if (!loadingTrips && !activeTripId) return (
    <Stack spacing={2}>
      <Typography variant="h5" fontWeight={800}>Settle Up</Typography>
      <Alert severity="info">Select a trip from the top bar first.</Alert>
    </Stack>
  );

  return (
    <Box>
      <Stack spacing={2}>
        <Typography variant="h5" fontWeight={800}>Settle Up — {activeTripName}</Typography>

        {error && <Alert severity="error">{error}</Alert>}

        {loading || loadingTrips ? (
          <Box sx={{ display: "grid", placeItems: "center", py: 6 }}><CircularProgress /></Box>
        ) : expenses.length === 0 ? (
          <Alert severity="info">No expenses yet — nothing to settle up.</Alert>
        ) : (
          <>
            {/* ── Row 1: KPI cards ── */}
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 2 }}>
              <Card>
                <CardContent sx={{ py: 2 }}>
                  <Typography variant="overline" sx={{ opacity: 0.75 }}>Total Trip Spend</Typography>
                  <Typography variant="h4" fontWeight={900}>{formatMoney(totalCents)}</Typography>
                </CardContent>
              </Card>
              <Card>
                <CardContent sx={{ py: 2 }}>
                  <Typography variant="overline" sx={{ opacity: 0.75 }}>People</Typography>
                  <Typography variant="h4" fontWeight={900}>{perPerson.length}</Typography>
                </CardContent>
              </Card>
              <Card sx={{
                bgcolor: alpha(allSettled ? theme.palette.success.main : theme.palette.warning.main, 0.08),
                border: `1px solid ${alpha(allSettled ? theme.palette.success.main : theme.palette.warning.main, 0.2)}`,
              }}>
                <CardContent sx={{ py: 2 }}>
                  <Typography variant="overline" sx={{ opacity: 0.75 }}>Status</Typography>
                  <Typography variant="h5" fontWeight={900}
                    color={allSettled ? "success.main" : "warning.main"}>
                    {allSettled ? "All Settled ✓" : "Pending"}
                  </Typography>
                </CardContent>
              </Card>
            </Box>

            {/* ── Row 2: My personal status ── */}
            {myName && (
              <Card sx={{
                bgcolor: alpha(iAllSettled ? theme.palette.success.main : theme.palette.primary.main, 0.05),
                border: `1px solid ${alpha(iAllSettled ? theme.palette.success.main : theme.palette.primary.main, 0.18)}`,
              }}>
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                    <PersonOutlineIcon color="primary" />
                    <Typography variant="h6" fontWeight={800}>Your Status, {myName}</Typography>
                  </Stack>
                  <Divider sx={{ mb: 2 }} />
                  {iAllSettled ? (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <CheckCircleOutlineIcon color="success" />
                      <Typography variant="body1" color="success.main" fontWeight={700}>
                        You're all settled up!
                      </Typography>
                    </Stack>
                  ) : (
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: myOwes.length > 0 && myOwed.length > 0 ? "1fr 1fr" : "1fr" }, gap: 2 }}>
                      {myOwes.length > 0 && (
                        <Stack spacing={1}>
                          <Typography variant="body2" fontWeight={700} color="error.main">You owe:</Typography>
                          {myOwes.map((t, i) => (
                            <Stack key={i} direction="row" alignItems="center" justifyContent="space-between"
                              sx={{ px: 1.5, py: 1, borderRadius: 2,
                                bgcolor: alpha(theme.palette.error.main, 0.07),
                                border: `1px solid ${alpha(theme.palette.error.main, 0.15)}` }}>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <ArrowForwardIcon fontSize="small" sx={{ opacity: 0.5 }} />
                                <Typography variant="body2" fontWeight={700}>{t.to}</Typography>
                              </Stack>
                              <Stack alignItems="flex-end">
                                <Typography variant="body2" fontWeight={800} color="error.main">
                                  {formatMoney(t.remainingCents)}
                                </Typography>
                                {t.paidCents > 0 && (
                                  <Typography variant="caption" color="success.main">
                                    {formatMoney(t.paidCents)} paid
                                  </Typography>
                                )}
                              </Stack>
                            </Stack>
                          ))}
                        </Stack>
                      )}
                      {myOwed.length > 0 && (
                        <Stack spacing={1}>
                          <Typography variant="body2" fontWeight={700} color="success.main">You're owed:</Typography>
                          {myOwed.map((t, i) => (
                            <Stack key={i} direction="row" alignItems="center" justifyContent="space-between"
                              sx={{ px: 1.5, py: 1, borderRadius: 2,
                                bgcolor: alpha(theme.palette.success.main, 0.07),
                                border: `1px solid ${alpha(theme.palette.success.main, 0.15)}` }}>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Typography variant="body2" fontWeight={700}>{t.from}</Typography>
                                <ArrowForwardIcon fontSize="small" sx={{ opacity: 0.5 }} />
                              </Stack>
                              <Typography variant="body2" fontWeight={800} color="success.main">
                                {formatMoney(t.remainingCents)}
                              </Typography>
                            </Stack>
                          ))}
                        </Stack>
                      )}
                    </Box>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ── Row 3: Who paid + Transfers ── */}
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" fontWeight={800} sx={{ mb: 1.5 }}>Who Paid What</Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Stack spacing={1.5}>
                    {perPerson.sort((a, b) => b.paidCents - a.paidCents).map((p) => {
                      const isMe = myName && p.name.toLowerCase() === myName.toLowerCase();
                      return (
                        <Stack key={p.name} direction="row" alignItems="center" spacing={1.5}
                          sx={{ px: 1.5, py: 1, borderRadius: 2,
                            bgcolor: alpha(theme.palette.primary.main, isMe ? 0.08 : 0.03),
                            border: `1px solid ${alpha(theme.palette.primary.main, isMe ? 0.2 : 0.08)}` }}>
                          <Avatar sx={{ width: 34, height: 34, fontSize: 12, fontWeight: 800,
                            bgcolor: alpha(theme.palette.primary.main, 0.15), color: theme.palette.primary.main }}>
                            {initials(p.name)}
                          </Avatar>
                          <Box sx={{ flex: 1 }}>
                            <Stack direction="row" spacing={0.5} alignItems="center">
                              <Typography variant="body2" fontWeight={700}>{p.name}</Typography>
                              {isMe && <Chip label="you" size="small" color="primary"
                                sx={{ height: 16, fontSize: 9, fontWeight: 800 }} />}
                            </Stack>
                            <Typography variant="caption" sx={{ opacity: 0.65 }}>
                              Paid {formatMoney(p.paidCents)} · share {formatMoney(p.shareCents)}
                            </Typography>
                          </Box>
                          {p.netCents > 0 && <Chip label={`+${formatMoney(p.netCents)}`} size="small" color="success" sx={{ fontWeight: 700 }} />}
                          {p.netCents < 0 && <Chip label={`-${formatMoney(-p.netCents)}`} size="small" color="error" sx={{ fontWeight: 700 }} />}
                          {p.netCents === 0 && <Chip label="even" size="small" sx={{ fontWeight: 700 }} />}
                        </Stack>
                      );
                    })}
                  </Stack>
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <Typography variant="h6" fontWeight={800} sx={{ mb: 0.5 }}>Suggested Transfers</Typography>
                  <Typography variant="body2" sx={{ opacity: 0.65, mb: 1.5 }}>Minimum payments to settle.</Typography>
                  <Divider sx={{ mb: 2 }} />
                  {allSettled ? (
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 2 }}>
                      <CheckCircleOutlineIcon color="success" />
                      <Typography color="success.main" fontWeight={700}>All settled!</Typography>
                    </Stack>
                  ) : (
                    <Stack spacing={1.5}>
                      {transfers.map((t, i) => {
                        const settled = t.remainingCents <= 0;
                        const isMyTransfer = myName && (
                          t.from.toLowerCase() === myName.toLowerCase() ||
                          t.to.toLowerCase() === myName.toLowerCase()
                        );
                        return (
                          <Box key={i} sx={{
                            borderRadius: 2,
                            border: `1px solid ${alpha(settled ? theme.palette.success.main : isMyTransfer ? theme.palette.primary.main : theme.palette.error.main, 0.25)}`,
                            bgcolor: alpha(settled ? theme.palette.success.main : isMyTransfer ? theme.palette.primary.main : theme.palette.error.main, 0.04),
                          }}>
                            <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 1.5, py: 1.2 }}>
                              <Typography variant="body2" fontWeight={800} color="error.main">{t.from}</Typography>
                              <ArrowForwardIcon fontSize="small" sx={{ opacity: 0.4 }} />
                              <Typography variant="body2" fontWeight={800}>{t.to}</Typography>
                              <Box sx={{ flex: 1 }} />
                              <Stack alignItems="flex-end">
                                <Typography variant="body2" fontWeight={800}>{formatMoney(t.owedCents)}</Typography>
                                {t.paidCents > 0 && <Typography variant="caption" color="success.main">{formatMoney(t.paidCents)} paid</Typography>}
                                {!settled && <Typography variant="caption" color="error.main" fontWeight={700}>{formatMoney(t.remainingCents)} left</Typography>}
                                {settled && <Chip label="Settled ✓" size="small" color="success" sx={{ height: 18, fontSize: 10, fontWeight: 800 }} />}
                              </Stack>
                            </Stack>
                            {!settled && (
                              <>
                                <Divider />
                                <Box sx={{ px: 1.5, py: 0.75 }}>
                                  <Button size="small" startIcon={<AddCircleOutlineIcon />}
                                    onClick={() => openRecordDialog(t.from, t.to, t.remainingCents)}>
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
            </Box>

            {/* ── Row 4: Payment history ── */}
            {payments.length > 0 && (
              <Card>
                <CardContent>
                  <Typography variant="h6" fontWeight={800} sx={{ mb: 1.5 }}>Payment History</Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Stack spacing={1}>
                    {[...payments].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((p) => {
                      const isMe = myName && (
                        p.fromUser.toLowerCase() === myName.toLowerCase() ||
                        p.toUser.toLowerCase() === myName.toLowerCase()
                      );
                      return (
                        <Stack key={p.paymentId} direction="row" alignItems="center" spacing={1.5}
                          sx={{ px: 1.5, py: 1, borderRadius: 2,
                            bgcolor: isMe ? alpha(theme.palette.primary.main, 0.05) : alpha(theme.palette.divider, 0.3),
                            border: `1px solid ${alpha(theme.palette.divider, 0.5)}` }}>
                          <Box sx={{ flex: 1 }}>
                            <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap">
                              <Typography variant="body2" fontWeight={700}>{p.fromUser}</Typography>
                              <Typography variant="body2" sx={{ opacity: 0.5 }}>paid</Typography>
                              <Typography variant="body2" fontWeight={700}>{p.toUser}</Typography>
                              <Typography variant="body2" fontWeight={800} color="success.main">
                                {formatMoney(p.amountCents)}
                              </Typography>
                            </Stack>
                            <Stack direction="row" spacing={1}>
                              <Typography variant="caption" sx={{ opacity: 0.55 }}>
                                {new Date(p.createdAt).toLocaleDateString()}
                              </Typography>
                              {p.note && <Typography variant="caption" sx={{ opacity: 0.6 }}>· {p.note}</Typography>}
                            </Stack>
                          </Box>
                          <Tooltip title="Remove payment">
                            <IconButton size="small" onClick={() => handleDeletePayment(p.paymentId)}
                              disabled={deletingPaymentId === p.paymentId}>
                              {deletingPaymentId === p.paymentId
                                ? <CircularProgress size={14} />
                                : <DeleteOutlineIcon sx={{ fontSize: 16, opacity: 0.5 }} />}
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      );
                    })}
                  </Stack>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </Stack>

      <Dialog open={dialogOpen} onClose={dialogSaving ? undefined : () => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Record a Payment</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {dialogError && <Alert severity="error">{dialogError}</Alert>}
            <Typography variant="body2"><b>{dialogFrom}</b> pays <b>{dialogTo}</b></Typography>
            <TextField label="Amount" value={dialogAmount} onChange={(e) => setDialogAmount(e.target.value)}
              type="number" inputProps={{ min: 0, step: "0.01" }} fullWidth disabled={dialogSaving}
              InputProps={{ startAdornment: <Typography sx={{ mr: 0.5, opacity: 0.6 }}>$</Typography> }} />
            <TextField label="Note (optional)" value={dialogNote} onChange={(e) => setDialogNote(e.target.value)}
              fullWidth disabled={dialogSaving} placeholder="e.g. Venmo, cash, etc." />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={dialogSaving}>Cancel</Button>
          <Button variant="contained" onClick={handleRecordPayment} disabled={dialogSaving || !dialogAmount}>
            {dialogSaving ? <CircularProgress size={18} color="inherit" /> : "Record"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}