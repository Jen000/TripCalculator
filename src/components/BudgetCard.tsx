import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Divider,
  IconButton,
  LinearProgress,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import CheckIcon from "@mui/icons-material/Check";
import { useBudget } from "../context/BudgetContext";
import type { Expense } from "../api/expenses";

const CATEGORIES = [
  "Lodging", "Gas", "Food", "Coffee", "Groceries", "Activities",
  "Park Fees", "Transit / Parking", "Shopping", "Flights", "Rental Car", "Misc",
];

function formatMoney(cents: number) {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function BudgetBar({
  label,
  spentCents,
  limitCents,
  isTotal,
}: {
  label: string;
  spentCents: number;
  limitCents: number;
  isTotal?: boolean;
}) {
  const theme = useTheme();
  const pct = limitCents > 0 ? Math.min((spentCents / limitCents) * 100, 100) : 0;
  const over = spentCents > limitCents;
  const warn = pct >= 80 && !over;

  const barColor = over
    ? theme.palette.error.main
    : warn
    ? theme.palette.warning.main
    : theme.palette.primary.main;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
        <Typography variant={isTotal ? "body1" : "body2"} fontWeight={isTotal ? 800 : 600}>
          {label}
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="caption" sx={{ opacity: 0.75 }}>
            {formatMoney(spentCents)} / {formatMoney(limitCents)}
          </Typography>
          {over && (
            <Chip
              label={`Over by ${formatMoney(spentCents - limitCents)}`}
              size="small"
              color="error"
              sx={{ height: 20, fontSize: 10, fontWeight: 700 }}
            />
          )}
          {warn && (
            <Chip
              label={`${Math.round(pct)}%`}
              size="small"
              color="warning"
              sx={{ height: 20, fontSize: 10, fontWeight: 700 }}
            />
          )}
        </Stack>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={pct}
        sx={{
          height: isTotal ? 10 : 6,
          borderRadius: 99,
          bgcolor: alpha(barColor, 0.15),
          "& .MuiLinearProgress-bar": { bgcolor: barColor, borderRadius: 99 },
        }}
      />
    </Box>
  );
}

interface Props {
  tripId: string;
  expenses: Expense[];
}

export default function BudgetCard({ tripId, expenses }: Props) {
  const { getBudget, setBudget } = useBudget();
  const budget = getBudget(tripId);

  const [editing, setEditing] = useState(false);
  const [totalInput, setTotalInput] = useState(
    budget.totalLimitCents !== null ? (budget.totalLimitCents / 100).toFixed(2) : ""
  );
  const [catBudgets, setCatBudgets] = useState(
    budget.categoryBudgets.map((cb) => ({
      category: cb.category,
      input: (cb.limitCents / 100).toFixed(2),
    }))
  );
  const [newCat, setNewCat] = useState(CATEGORIES[0]);
  const [saveError, setSaveError] = useState<string | null>(null);

  const totalSpentCents = useMemo(
    () => expenses.reduce((s, e) => s + (e.costCents ?? 0), 0),
    [expenses]
  );

  const spentByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses) {
      map.set(e.category, (map.get(e.category) ?? 0) + (e.costCents ?? 0));
    }
    return map;
  }, [expenses]);

  const hasBudget =
    budget.totalLimitCents !== null || budget.categoryBudgets.length > 0;

  const handleSave = () => {
    setSaveError(null);
    const total = totalInput.trim() === "" ? null : Number(totalInput);
    if (total !== null && (!Number.isFinite(total) || total < 0)) {
      setSaveError("Invalid total budget.");
      return;
    }

    const categoryBudgets = [];
    for (const cb of catBudgets) {
      const v = Number(cb.input);
      if (!Number.isFinite(v) || v < 0) {
        setSaveError(`Invalid budget for ${cb.category}.`);
        return;
      }
      categoryBudgets.push({ category: cb.category, limitCents: Math.round(v * 100) });
    }

    setBudget(tripId, {
      totalLimitCents: total !== null ? Math.round(total * 100) : null,
      categoryBudgets,
    });
    setEditing(false);
  };

  const addCatBudget = () => {
    if (catBudgets.find((cb) => cb.category === newCat)) return;
    setCatBudgets((prev) => [...prev, { category: newCat, input: "" }]);
  };

  const removeCatBudget = (cat: string) => {
    setCatBudgets((prev) => prev.filter((cb) => cb.category !== cat));
  };

  const availableCats = CATEGORIES.filter(
    (c) => !catBudgets.find((cb) => cb.category === c)
  );

  return (
    <Card>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" fontWeight={800}>
            Budget
          </Typography>
          <Tooltip title={editing ? "Save" : "Edit budgets"}>
            <IconButton
              size="small"
              onClick={editing ? handleSave : () => {
                setTotalInput(
                  budget.totalLimitCents !== null
                    ? (budget.totalLimitCents / 100).toFixed(2)
                    : ""
                );
                setCatBudgets(
                  budget.categoryBudgets.map((cb) => ({
                    category: cb.category,
                    input: (cb.limitCents / 100).toFixed(2),
                  }))
                );
                setSaveError(null);
                setEditing(true);
              }}
              color={editing ? "primary" : "default"}
            >
              {editing ? <CheckIcon /> : <EditOutlinedIcon />}
            </IconButton>
          </Tooltip>
        </Stack>

        <Divider sx={{ my: 1.5 }} />

        {!hasBudget && !editing && (
          <Stack spacing={1} alignItems="center" sx={{ py: 2 }}>
            <Typography variant="body2" sx={{ opacity: 0.7, textAlign: "center" }}>
              No budget set for this trip yet.
            </Typography>
            <Button
              size="small"
              startIcon={<AddCircleOutlineIcon />}
              onClick={() => setEditing(true)}
            >
              Set a budget
            </Button>
          </Stack>
        )}

        {/* Edit mode */}
        <Collapse in={editing}>
          <Stack spacing={2} sx={{ mb: 2 }}>
            {saveError && <Alert severity="error">{saveError}</Alert>}

            <TextField
              label="Total trip budget (optional)"
              value={totalInput}
              onChange={(e) => setTotalInput(e.target.value)}
              type="number"
              inputProps={{ min: 0, step: "1" }}
              size="small"
              fullWidth
              placeholder="e.g. 2000"
              InputProps={{ startAdornment: <Typography sx={{ mr: 0.5, opacity: 0.6 }}>$</Typography> }}
            />

            <Divider />

            <Typography variant="body2" fontWeight={700}>
              Per-category budgets
            </Typography>

            {catBudgets.map((cb) => (
              <Stack key={cb.category} direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" sx={{ minWidth: 130 }}>
                  {cb.category}
                </Typography>
                <TextField
                  value={cb.input}
                  onChange={(e) =>
                    setCatBudgets((prev) =>
                      prev.map((x) =>
                        x.category === cb.category ? { ...x, input: e.target.value } : x
                      )
                    )
                  }
                  type="number"
                  inputProps={{ min: 0, step: "1" }}
                  size="small"
                  fullWidth
                  placeholder="Limit $"
                />
                <IconButton size="small" color="error" onClick={() => removeCatBudget(cb.category)}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Stack>
            ))}

            {availableCats.length > 0 && (
              <Stack direction="row" spacing={1}>
                <TextField
                  select
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value)}
                  size="small"
                  sx={{ flex: 1 }}
                >
                  {availableCats.map((c) => (
                    <MenuItem key={c} value={c}>
                      {c}
                    </MenuItem>
                  ))}
                </TextField>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddCircleOutlineIcon />}
                  onClick={addCatBudget}
                >
                  Add
                </Button>
              </Stack>
            )}

            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button size="small" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button size="small" variant="contained" onClick={handleSave}>
                Save Budget
              </Button>
            </Stack>
          </Stack>
        </Collapse>

        {/* Display mode */}
        {!editing && hasBudget && (
          <Stack spacing={2}>
            {budget.totalLimitCents !== null && (
              <BudgetBar
                label="Total Trip"
                spentCents={totalSpentCents}
                limitCents={budget.totalLimitCents}
                isTotal
              />
            )}

            {budget.categoryBudgets.length > 0 && (
              <>
                {budget.totalLimitCents !== null && <Divider />}
                {budget.categoryBudgets.map((cb) => (
                  <BudgetBar
                    key={cb.category}
                    label={cb.category}
                    spentCents={spentByCategory.get(cb.category) ?? 0}
                    limitCents={cb.limitCents}
                  />
                ))}
              </>
            )}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}