import { useEffect, useState } from "react";
import {
  Accordion, AccordionDetails, AccordionSummary,
  Alert, Box, Button, Card, CardContent, CircularProgress,
  Chip, Divider, IconButton, Slider, Stack, Tooltip, Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import type { SplitRules, PersonSplit } from "../api/tripSettings";

interface Props {
  people: string[];
  categories: string[];
  splitRules: SplitRules;
  onSave: (rules: SplitRules) => Promise<void>;
}

/**
 * Smart slider adjustment with priority ordering:
 * - People BEFORE changedIndex keep their values (higher priority, locked).
 * - The changed person is clamped to the space remaining after locked people.
 * - People AFTER changedIndex share whatever is left equally (lower priority).
 */
function adjustSplits(splits: PersonSplit[], changedIndex: number, newValue: number): PersonSplit[] {
  const result = [...splits];
  const lockedBefore = result.slice(0, changedIndex).reduce((s, p) => s + p.percentage, 0);
  const clamped = Math.min(Math.max(0, newValue), 100 - lockedBefore);
  result[changedIndex] = { ...result[changedIndex], percentage: clamped };
  const remaining = 100 - lockedBefore - clamped;
  const lowerCount = result.length - changedIndex - 1;
  if (lowerCount === 0) return result;
  const equalShare = Math.floor(remaining / lowerCount);
  const rem = remaining - equalShare * lowerCount;
  for (let i = changedIndex + 1; i < result.length; i++) {
    result[i] = { ...result[i], percentage: equalShare + (i === result.length - 1 ? rem : 0) };
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

function isCustom(splits: PersonSplit[], template: PersonSplit[]): boolean {
  if (splits.length !== template.length) return true;
  for (const s of splits) {
    const t = template.find((t) => t.name === s.name);
    if (!t || t.percentage !== s.percentage) return true;
  }
  return false;
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
            onChange={(_, v) => onChange(adjustSplits(splits, i, v as number))}
            min={0} max={100} step={1}
            sx={{ color: theme.palette.primary.main, "& .MuiSlider-thumb": { width: 16, height: 16 } }}
          />
        </Box>
      ))}
      <Stack
        direction="row" justifyContent="space-between" alignItems="center"
        sx={{ pt: 0.5, borderTop: `1px solid ${alpha(theme.palette.divider, 0.5)}` }}
      >
        <Typography variant="caption" sx={{ opacity: 0.65 }}>Total</Typography>
        <Typography variant="caption" fontWeight={800} color={isValid ? "success.main" : "error.main"}>
          {total}%{" "}
          {isValid
            ? "✓"
            : `— needs ${100 - total > 0 ? `+${100 - total}` : 100 - total}% adjustment`}
        </Typography>
      </Stack>
    </Stack>
  );
}

export default function SplitRulesCard({ people, categories, splitRules, onSave }: Props) {
  const theme = useTheme();

  const [template, setTemplate] = useState<PersonSplit[]>(() =>
    makeSplits(people, splitRules.defaultSplit ?? [])
  );

  const [categorySplits, setCategorySplits] = useState<Record<string, PersonSplit[]>>(() => {
    const result: Record<string, PersonSplit[]> = {};
    for (const cat of categories) {
      const override = (splitRules.categoryOverrides ?? []).find((o) => o.category === cat);
      result[cat] = makeSplits(people, override?.people ?? splitRules.defaultSplit ?? []);
    }
    return result;
  });

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Sync when external data changes (e.g. save confirmed, people added)
  useEffect(() => {
    if (people.length === 0) return;
    const newTemplate = makeSplits(people, splitRules.defaultSplit ?? []);
    setTemplate(newTemplate);
    setCategorySplits(() => {
      const result: Record<string, PersonSplit[]> = {};
      for (const cat of categories) {
        const override = (splitRules.categoryOverrides ?? []).find((o) => o.category === cat);
        result[cat] = makeSplits(people, override?.people ?? splitRules.defaultSplit ?? []);
      }
      return result;
    });
  }, [people.join(","), splitRules.defaultSplit?.length, splitRules.categoryOverrides?.length]);

  // For categories added after the last sync, fall back to the current template
  const getSplits = (cat: string): PersonSplit[] =>
    categorySplits[cat] ?? makeSplits(people, template);

  const applyToAll = () => {
    const next: Record<string, PersonSplit[]> = {};
    for (const cat of categories) next[cat] = [...template];
    setCategorySplits(next);
  };

  const handleSave = async () => {
    const templateTotal = template.reduce((s, p) => s + p.percentage, 0);
    if (templateTotal !== 100) {
      setMsg({ type: "error", text: `Default template totals ${templateTotal}% — must be 100%.` });
      return;
    }
    for (const cat of categories) {
      const total = getSplits(cat).reduce((s, p) => s + p.percentage, 0);
      if (total !== 100) {
        setMsg({ type: "error", text: `${cat} split totals ${total}% — must be 100%.` });
        return;
      }
    }
    setSaving(true);
    setMsg(null);
    try {
      await onSave({
        defaultSplit: template,
        categoryOverrides: categories.map((cat) => ({
          category: cat,
          people: getSplits(cat),
        })),
      });
      setMsg({ type: "success", text: "Split rules saved." });
    } catch (e: any) {
      setMsg({ type: "error", text: e?.message ?? "Failed to save." });
    } finally {
      setSaving(false);
    }
  };

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
          Configure how each expense category is split between trip members.
        </Typography>
        <Divider sx={{ my: 1.5 }} />
        {msg && <Alert severity={msg.type} sx={{ mb: 1.5 }}>{msg.text}</Alert>}

        {/* ── Default Template ── */}
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1.5 }}>
          <Stack spacing={0.25}>
            <Typography variant="body2" fontWeight={700}>Default Template</Typography>
            <Typography variant="caption" sx={{ opacity: 0.65 }}>
              Set a split here, then apply it to every category at once.
            </Typography>
          </Stack>
          <Tooltip title="Copy this split to all categories">
            <Button
              size="small"
              variant="outlined"
              startIcon={<ContentCopyIcon fontSize="small" />}
              onClick={applyToAll}
              sx={{ flexShrink: 0, ml: 2 }}
            >
              Apply to all
            </Button>
          </Tooltip>
        </Stack>
        <SplitEditor splits={template} onChange={setTemplate} />

        {/* ── Per-Category Rules ── */}
        {categories.length > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="body2" fontWeight={700} sx={{ mb: 1 }}>
              Per-Category Rules
            </Typography>
            <Stack spacing={1}>
              {categories.map((cat) => {
                const splits = getSplits(cat);
                const custom = isCustom(splits, template);
                return (
                  <Accordion
                    key={cat}
                    disableGutters
                    elevation={0}
                    sx={{
                      border: `1px solid ${alpha(
                        custom ? theme.palette.primary.main : theme.palette.divider,
                        custom ? 0.22 : 0.5
                      )}`,
                      borderRadius: "8px !important",
                      "&:before": { display: "none" },
                      bgcolor: alpha(theme.palette.primary.main, custom ? 0.04 : 0),
                    }}
                  >
                    <AccordionSummary
                      expandIcon={<ExpandMoreIcon />}
                      sx={{ minHeight: 48, "& .MuiAccordionSummary-content": { my: 0.75 } }}
                    >
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ flex: 1, mr: 1 }}>
                        <Typography variant="body2" fontWeight={700}>{cat}</Typography>
                        <Chip
                          label={custom ? "custom" : "same as default"}
                          size="small"
                          color={custom ? "primary" : "default"}
                          sx={{ height: 18, fontSize: 10, fontWeight: 700 }}
                        />
                      </Stack>
                      {custom && (
                        <Tooltip title="Reset to default template">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCategorySplits((prev) => ({ ...prev, [cat]: [...template] }));
                            }}
                            sx={{ mr: 0.5 }}
                          >
                            <RestartAltIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </AccordionSummary>
                    <AccordionDetails sx={{ pt: 0, px: 2, pb: 2 }}>
                      <SplitEditor
                        splits={splits}
                        onChange={(newSplits) =>
                          setCategorySplits((prev) => ({ ...prev, [cat]: newSplits }))
                        }
                      />
                    </AccordionDetails>
                  </Accordion>
                );
              })}
            </Stack>
          </>
        )}

        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          sx={{ mt: 2 }}
          fullWidth
        >
          {saving ? <CircularProgress size={18} color="inherit" /> : "Save Split Rules"}
        </Button>
      </CardContent>
    </Card>
  );
}
