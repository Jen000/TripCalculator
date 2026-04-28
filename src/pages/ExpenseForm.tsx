import { useEffect, useMemo, useState } from "react";
import {
  Alert, Button, Card, CardContent, CircularProgress,
  MenuItem, Stack, TextField, Typography,
} from "@mui/material";
import { useTrip } from "../context/TripContext";
import { useTripSettings, DEFAULT_CATEGORIES } from "../context/TripSettingsContext";
import { postExpense } from "../api/expenses";

export default function ExpenseForm() {
  const { activeTripId, trips, loadingTrips } = useTrip();
  const { getSettings, loadSettings } = useTripSettings();

  const activeTripName = useMemo(
    () => trips.find((t) => t.tripId === activeTripId)?.name ?? "Trip",
    [trips, activeTripId]
  );

  useEffect(() => {
    if (activeTripId) loadSettings(activeTripId);
  }, [activeTripId]);

  const settings = activeTripId ? getSettings(activeTripId) : null;
  const categories = settings?.categories?.length ? settings.categories : DEFAULT_CATEGORIES;
  const people = settings?.people ?? [];

  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [whoPaid, setWhoPaid] = useState("");
  const [category, setCategory] = useState(categories[0]);
  const [cost, setCost] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Keep category in sync if categories change
  useEffect(() => {
    if (!categories.includes(category)) setCategory(categories[0]);
  }, [categories.join(",")]);

  // Reset whoPaid if people list changes and current value is no longer valid
  useEffect(() => {
    if (people.length > 0 && !people.includes(whoPaid)) setWhoPaid("");
  }, [people.join(",")]);

  const canSubmit = !!activeTripId && date && description.trim() && whoPaid && category && cost;

  const handleSubmit = async () => {
    setMsg(null);
    if (!activeTripId) {
      setMsg({ type: "error", text: "Select a trip in the top bar first." });
      return;
    }
    const costNumber = Number(cost);
    if (!Number.isFinite(costNumber) || costNumber < 0) {
      setMsg({ type: "error", text: "Please enter a valid cost." });
      return;
    }
    setSaving(true);
    try {
      await postExpense({ tripId: activeTripId, date, description: description.trim(), whoPaid, category, cost: costNumber });
      setDate(""); setDescription(""); setWhoPaid(""); setCategory(categories[0]); setCost("");
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
        <Typography variant="h5" fontWeight={800}>Add Expense</Typography>
        <Alert severity="info">
          You don't have a trip selected yet. Create a trip in <b>Trip Settings</b>, then select it from the top bar.
        </Alert>
      </Stack>
    );
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h5" fontWeight={800}>Add Expense — {activeTripName}</Typography>
      <Card>
        <CardContent>
          <Stack spacing={2}>
            {msg && <Alert severity={msg.type}>{msg.text}</Alert>}

            <TextField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)}
              InputLabelProps={{ shrink: true }} fullWidth />

            <TextField label="Purchase description" value={description}
              onChange={(e) => setDescription(e.target.value)} fullWidth />

            {/* Who Paid — dropdown if people list exists, free text fallback */}
            {people.length > 0 ? (
              <TextField select label="Who paid?" value={whoPaid} onChange={(e) => setWhoPaid(e.target.value)} fullWidth>
                <MenuItem value=""><em>Select a person…</em></MenuItem>
                {people.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
              </TextField>
            ) : (
              <TextField
                label="Who paid?"
                value={whoPaid}
                onChange={(e) => setWhoPaid(e.target.value)}
                fullWidth
                helperText="Add people in Trip Settings to get a dropdown here."
              />
            )}

            <TextField select label="Category" value={category} onChange={(e) => setCategory(e.target.value)} fullWidth>
              {categories.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>

            <TextField label="Cost" type="number" value={cost} onChange={(e) => setCost(e.target.value)}
              inputProps={{ min: 0, step: "0.01" }} fullWidth />

            <Button variant="contained" onClick={handleSubmit} disabled={!canSubmit || saving}>
              {saving ? <CircularProgress size={18} color="inherit" /> : "Add Expense"}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}