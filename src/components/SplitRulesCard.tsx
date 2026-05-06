import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, CircularProgress,
  Chip, Divider, IconButton, MenuItem, Slider, Stack, TextField, Tooltip, Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import type { SplitRules, PersonSplit, CategorySplitOverride } from "../api/tripSettings";

interface Props {
  people: string[];
  categories: string[];
  splitRules: SplitRules;
  onSave: (rules: SplitRules) => Promise<void>;
}

/**
 * Smart slider adjustment:
 * When person at `changedIndex` moves their slider to `newValue`,
 * distribute the remaining percentage equally among the others,
 * with the last person absorbing any rounding remainder.
 * People before `changedIndex` keep their values (priority order).
 */
function adjustSplits(splits: PersonSplit[], changedIndex: number, newValue: number): PersonSplit[] {
  const result = [...splits];
  result[changedIndex] = { ...result[changedIndex], percentage: newValue };

  // Sum of all other people's current percentages
  const remaining = 100 - newValue;
  const others = result.filter((_, i) => i !== changedIndex);

  if (others.length === 0) return result;

  // Distribute remaining equally
  const equalShare = Math.floor(remaining / others.length);
  const remainder = remaining - equalShare * others.length;

  let othersIdx = 0;
  for (let i = 0; i < result.length; i++) {
    if (i === changedIndex) continue;
    // Last other person gets the remainder
    const isLast = othersIdx === others.length - 1;
    result[i] = {
      ...result[i],
      percentage: Math.max(0, equalShare + (isLast ? remainder : 0)),
    };
    othersIdx++;
  }

  return result;
}

function makeSplits(people: string[], existing: PersonSplit[]): PersonSplit[] {
  if (people.length === 0) return [];
  const equalPct = Math.floor(100 / people.length);
  const remainder = 100 - equalPct * people.length;
  return people.map((name, i) => {
    const found = existing.find((s) => s.name === name);
    if (found) return found;
    return { name, percentage: i === people.length - 1 ? equalPct + remainder : equalPct };
  });
}

function SplitEditor({
  splits,
  onChange,
}: {
  splits: PersonSplit[];
  onChange: (splits: PersonSplit[]) => void;
}) {
  const theme = useTheme();
  const total = splits.reduce((s, p) => s + p.percentage, 0);
  const isValid = total === 100;

  const handleChange = (index: number, value: number) => {
    // Clamp so this person can't exceed what's left for them
    const maxValue = 100 - splits.filter((_, i) => i !== index).reduce((s) => s + 0, 0);
    const clamped = Math.min(Math.max(0, value), 100);
    onChange(adjustSplits(splits, index, clamped));
  };

  return (
    <Stack spacing={1.5}>
      {splits.map((s, i) => (
        <Box key={s.name}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
            <Typography variant="body2" fontWeight={600}>{s.name}</Typography>
            <Chip
              label={`${s.percentage}%`}
              size="small"
              color={isValid ? "primary" : "warning"}
              sx={{ fontWeight: 700, minWidth: 52 }}
            />
          </Stack>
          <Slider
            value={s.percentage}
            onChange={(_, v) => handleChange(i, v as number)}
            min={0}
            max={100}
            step={1}
            sx={{
              color: theme.palette.primary.main,
              "& .MuiSlider-thumb": { width: 16, height: 16 },
            }}
          />
        </Box>
      ))}
      <Stack direction="row" justifyContent="space-between" alignItems="center"
        sx={{ pt: 0.5, borderTop: `1px solid ${alpha(theme.palette.divider, 0.5)}` }}>
        <Typography variant="caption" sx={{ opacity: 0.65 }}>Total</Typography>
        <Typography variant="caption" fontWeight={800}
          color={isValid ? "success.main" : "error.main"}>
          {total}% {isValid ? "✓" : `— needs ${100 - total > 0 ? `+${100 - total}` : 100 - total}% adjustment`}
        </Typography>
      </Stack>
    </Stack>
  );
}

export default function SplitRulesCard({ people, categories, splitRules, onSave }: Props) {
  const theme = useTheme();

  const [defaultSplit, setDefaultSplit] = useState<PersonSplit[]>(() =>
    makeSplits(people, splitRules.defaultSplit ?? [])
  );
  const [categoryOverrides, setCategoryOverrides] = useState<CategorySplitOverride[]>(
    splitRules.categoryOverrides ?? []
  );
  const [newOverrideCat, setNewOverrideCat] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Sync when people or splitRules change from outside
  useEffect(() => {
    if (people.length === 0) return;
    setDefaultSplit(makeSplits(people, splitRules.defaultSplit ?? []));
    setCategoryOverrides(splitRules.categoryOverrides ?? []);
  }, [people.join(","), splitRules.defaultSplit?.length, splitRules.categoryOverrides?.length]);

  const addCategoryOverride = () => {
    if (!newOverrideCat || categoryOverrides.find((o) => o.category === newOverrideCat)) return;
    const newOverride: CategorySplitOverride = {
      category: newOverrideCat,
      people: makeSplits(people, []),
    };
    setCategoryOverrides((prev) => [...prev, newOverride]);
    setNewOverrideCat("");
  };

  const removeOverride = (category: string) => {
    setCategoryOverrides((prev) => prev.filter((o) => o.category !== category));
  };

  const handleSave = async () => {
    const defaultTotal = defaultSplit.reduce((s, p) => s + p.percentage, 0);
    if (defaultTotal !== 100) {
      setMsg({ type: "error", text: `Default split adds up to ${defaultTotal}%, needs to be 100%.` });
      return;
    }
    for (const override of categoryOverrides) {
      const total = override.people.reduce((s, p) => s + p.percentage, 0);
      if (total !== 100) {
        setMsg({ type: "error", text: `${override.category} split adds up to ${total}%, needs to be 100%.` });
        return;
      }
    }
    setSaving(true); setMsg(null);
    try {
      await onSave({ defaultSplit, categoryOverrides });
      setMsg({ type: "success", text: "Split rules saved." });
    } catch (e: any) {
      setMsg({ type: "error", text: e?.message ?? "Failed to save." });
    } finally {
      setSaving(false);
    }
  };

  const availableOverrideCats = categories.filter(
    (c) => !categoryOverrides.find((o) => o.category === c)
  );

  if (people.length < 2) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={800}>Split Rules</Typography>
          <Divider sx={{ my: 1.5 }} />
          <Typography variant="body2" sx={{ opacity: 0.65 }}>
            Add at least 2 people to the trip to configure split rules.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" fontWeight={800}>Split Rules</Typography>
        <Typography variant="body2" sx={{ opacity: 0.7, mt: 0.5 }}>
          Set how expenses are split. Moving one slider auto-adjusts the others.
        </Typography>
        <Divider sx={{ my: 1.5 }} />
        {msg && <Alert severity={msg.type} sx={{ mb: 1.5 }}>{msg.text}</Alert>}

        {/* Default split */}
        <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>
          Default Split
        </Typography>
        <SplitEditor splits={defaultSplit} onChange={setDefaultSplit} />

        {/* Category overrides */}
        {categoryOverrides.length > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>
              Category Overrides
            </Typography>
            <Stack spacing={2}>
              {categoryOverrides.map((override) => (
                <Box key={override.category} sx={{
                  p: 1.5, borderRadius: 2,
                  bgcolor: alpha(theme.palette.primary.main, 0.04),
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
                }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                    <Typography variant="body2" fontWeight={700}>{override.category}</Typography>
                    <Tooltip title="Remove override">
                      <IconButton size="small" color="error" onClick={() => removeOverride(override.category)}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                  <SplitEditor
                    splits={override.people}
                    onChange={(newSplits) =>
                      setCategoryOverrides((prev) =>
                        prev.map((o) =>
                          o.category === override.category ? { ...o, people: newSplits } : o
                        )
                      )
                    }
                  />
                </Box>
              ))}
            </Stack>
          </>
        )}

        {/* Add category override */}
        {availableOverrideCats.length > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="body2" fontWeight={700} sx={{ mb: 1 }}>
              Add Category Override
            </Typography>
            <Stack direction="row" spacing={1}>
              <TextField
                select value={newOverrideCat}
                onChange={(e) => setNewOverrideCat(e.target.value)}
                size="small" sx={{ flex: 1 }} label="Category"
              >
                {availableOverrideCats.map((c) => (
                  <MenuItem key={c} value={c}>{c}</MenuItem>
                ))}
              </TextField>
              <Button variant="outlined" startIcon={<AddCircleOutlineIcon />}
                onClick={addCategoryOverride} disabled={!newOverrideCat}>
                Add
              </Button>
            </Stack>
          </>
        )}

        <Button variant="contained" onClick={handleSave} disabled={saving} sx={{ mt: 2 }} fullWidth>
          {saving ? <CircularProgress size={18} color="inherit" /> : "Save Split Rules"}
        </Button>
      </CardContent>
    </Card>
  );
}