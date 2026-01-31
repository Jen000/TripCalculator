import { useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Stack,
  TextField,
  Typography,
  MenuItem,
} from "@mui/material";

import { useTrip } from "../context/TripContext";
import { postExpense } from "../api/expenses";

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

export default function ExpenseForm() {
  const { activeTripId, trips, loadingTrips } = useTrip();

  const activeTripName = useMemo(
    () => trips.find((t) => t.tripId === activeTripId)?.name ?? "Trip",
    [trips, activeTripId]
  );

  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [whoPaid, setWhoPaid] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [cost, setCost] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const canSubmit = !!activeTripId && date && description.trim() && whoPaid.trim() && category && cost;

  const handleSubmit = async () => {
    setMsg(null);

    if (!activeTripId) {
      setMsg({ type: "error", text: "Select a trip in the top bar (or create one in Settings) first." });
      return;
    }

    const costNumber = Number(cost);
    if (!Number.isFinite(costNumber) || costNumber < 0) {
      setMsg({ type: "error", text: "Please enter a valid cost." });
      return;
    }

    setSaving(true);
    try {
      await postExpense({
        tripId: activeTripId,
        date,
        description: description.trim(),
        whoPaid: whoPaid.trim(),
        category,
        cost: costNumber,
      });

      setDate("");
      setDescription("");
      setWhoPaid("");
      setCategory(CATEGORIES[0]);
      setCost("");

      setMsg({ type: "success", text: "Expense added!" });
    } catch (e: any) {
      setMsg({ type: "error", text: e?.message || "Failed to add expense." });
    } finally {
      setSaving(false);
    }
  };

  if (!loadingTrips && !activeTripId) {
    return (
      <Stack spacing={2}>
        <Typography variant="h5" fontWeight={800}>
          Add Expense
        </Typography>
        <Alert severity="info">
          You don’t have a trip selected yet. Create a trip in <b>Settings</b>, then select it from the top bar.
        </Alert>
      </Stack>
    );
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h5" fontWeight={800}>
        Add Expense — {activeTripName}
      </Typography>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            {msg && <Alert severity={msg.type}>{msg.text}</Alert>}

            <TextField
              label="Date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />

            <TextField
              label="Purchase description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
            />

            <TextField
              label="Who paid?"
              value={whoPaid}
              onChange={(e) => setWhoPaid(e.target.value)}
              fullWidth
            />

            <TextField
              select
              label="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              fullWidth
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
            />

            <Button variant="contained" onClick={handleSubmit} disabled={!canSubmit || saving}>
              Add Expense
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
