import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";
import { updateExpense, type Expense } from "../api/expenses";

const CATEGORIES = [
  "Lodging",
  "Gas",
  "Food",
  "Coffee",
  "Groceries",
  "Activities",
  "Park Fees",
  "Transit / Parking",
  "Shopping",
  "Flights",
  "Rental Car",
  "Misc",
];

interface Props {
  expense: Expense | null;
  open: boolean;
  onClose: () => void;
  onSaved: (updated: Expense) => void;
}

export default function ExpenseEditDialog({ expense, open, onClose, onSaved }: Props) {
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [whoPaid, setWhoPaid] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [cost, setCost] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (expense) {
      setDate(expense.date);
      setDescription(expense.description);
      setWhoPaid(expense.whoPaid);
      setCategory(expense.category);
      setCost((expense.costCents / 100).toFixed(2));
      setError(null);
    }
  }, [expense]);

  const handleSave = async () => {
    if (!expense) return;
    setError(null);

    const costNumber = Number(cost);
    if (!Number.isFinite(costNumber) || costNumber < 0) {
      setError("Please enter a valid cost.");
      return;
    }

    setSaving(true);
    try {
      const result = await updateExpense(expense.expenseId, {
        date,
        description: description.trim(),
        whoPaid: whoPaid.trim(),
        category,
        cost: costNumber,
      });
      onSaved(result.expense);
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "Failed to update expense.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Edit Expense</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <TextField
            label="Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
            disabled={saving}
          />
          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            disabled={saving}
          />
          <TextField
            label="Who Paid"
            value={whoPaid}
            onChange={(e) => setWhoPaid(e.target.value)}
            fullWidth
            disabled={saving}
          />
          <TextField
            select
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            fullWidth
            disabled={saving}
          >
            {CATEGORIES.map((c) => (
              <MenuItem key={c} value={c}>
                {c}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Cost"
            type="number"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            inputProps={{ min: 0, step: "0.01" }}
            fullWidth
            disabled={saving}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || !date || !description.trim() || !whoPaid.trim()}
        >
          {saving ? <CircularProgress size={18} color="inherit" /> : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}