import { useMemo } from "react";
import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import type { Expense } from "../api/expenses";

function formatMoney(cents: number) {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

/**
 * Greedy minimum-transfers settle-up algorithm.
 * Each person's fair share = total / n_people.
 * Net balance = what they paid - their fair share.
 * Positive balance → owed money; negative balance → owes money.
 * We then greedily match largest creditor with largest debtor.
 */
function computeSettleUp(expenses: Expense[]): {
  perPerson: { name: string; paidCents: number; shareCents: number; netCents: number }[];
  transfers: { from: string; to: string; cents: number }[];
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

  // Build mutable balances
  const balances = new Map(perPerson.map((p) => [p.name, p.netCents]));

  // Greedy matching
  const transfers: { from: string; to: string; cents: number }[] = [];

  const getCreditors = () =>
    Array.from(balances.entries())
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);
  const getDebtors = () =>
    Array.from(balances.entries())
      .filter(([, v]) => v < 0)
      .sort((a, b) => a[1] - b[1]);

  let safety = 0;
  while (safety++ < 1000) {
    const creditors = getCreditors();
    const debtors = getDebtors();
    if (creditors.length === 0 || debtors.length === 0) break;

    const [creditor, creditAmt] = creditors[0];
    const [debtor, debtAmt] = debtors[0];
    const amount = Math.min(creditAmt, -debtAmt);

    if (amount <= 0) break;

    transfers.push({ from: debtor, to: creditor, cents: amount });
    balances.set(creditor, creditAmt - amount);
    balances.set(debtor, debtAmt + amount);
  }

  return { perPerson, transfers };
}

interface Props {
  expenses: Expense[];
}

export default function SettleUpCard({ expenses }: Props) {
  const theme = useTheme();
  const { perPerson, transfers } = useMemo(() => computeSettleUp(expenses), [expenses]);

  if (perPerson.length === 0) return null;

  const allSettled = transfers.length === 0;

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" fontWeight={800}>
          Settle Up
        </Typography>
        <Divider sx={{ my: 1.5 }} />

        {/* Per-person breakdown */}
        <Stack spacing={1} sx={{ mb: 2 }}>
          {perPerson
            .sort((a, b) => b.paidCents - a.paidCents)
            .map((p) => {
              const net = p.netCents;
              const isOwed = net > 0;
              const isOwes = net < 0;
              return (
                <Stack
                  key={p.name}
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{
                    px: 1.5,
                    py: 1,
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.primary.main, 0.04),
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.08)}`,
                  }}
                >
                  <Typography variant="body2" fontWeight={700}>
                    {p.name}
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="caption" sx={{ opacity: 0.65 }}>
                      paid {formatMoney(p.paidCents)}
                    </Typography>
                    {isOwed && (
                      <Chip
                        label={`gets back ${formatMoney(net)}`}
                        size="small"
                        color="success"
                        sx={{ height: 20, fontSize: 10, fontWeight: 700 }}
                      />
                    )}
                    {isOwes && (
                      <Chip
                        label={`owes ${formatMoney(-net)}`}
                        size="small"
                        color="error"
                        sx={{ height: 20, fontSize: 10, fontWeight: 700 }}
                      />
                    )}
                    {!isOwed && !isOwes && (
                      <Chip
                        label="even"
                        size="small"
                        sx={{ height: 20, fontSize: 10, fontWeight: 700 }}
                      />
                    )}
                  </Stack>
                </Stack>
              );
            })}
        </Stack>

        <Divider sx={{ mb: 2 }} />

        {/* Transfers */}
        <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>
          Suggested transfers
        </Typography>

        {allSettled ? (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 1 }}>
            <CheckCircleOutlineIcon color="success" fontSize="small" />
            <Typography variant="body2" color="success.main" fontWeight={600}>
              Everyone is even — no transfers needed!
            </Typography>
          </Stack>
        ) : (
          <Stack spacing={1}>
            {transfers.map((t, i) => (
              <Box
                key={i}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  px: 1.5,
                  py: 1,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.error.main, 0.05),
                  border: `1px solid ${alpha(theme.palette.error.main, 0.12)}`,
                }}
              >
                <Typography variant="body2" fontWeight={700} color="error.main">
                  {t.from}
                </Typography>
                <ArrowForwardIcon fontSize="small" sx={{ opacity: 0.5 }} />
                <Typography variant="body2" fontWeight={700}>
                  {t.to}
                </Typography>
                <Box sx={{ flex: 1 }} />
                <Typography variant="body2" fontWeight={800}>
                  {formatMoney(t.cents)}
                </Typography>
              </Box>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}