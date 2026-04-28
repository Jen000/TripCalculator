import { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle, Divider,
  IconButton, MenuItem, Stack, TextField, Tooltip, Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import PersonAddOutlinedIcon from "@mui/icons-material/PersonAddOutlined";

import { useTrip } from "../context/TripContext";
import { useUser } from "../context/UserContext";
import { useTripSettings } from "../context/TripSettingsContext";
import { inviteTripMember, removeTripMember, renameTripApi } from "../api/tripSettings";
import { deleteTrip } from "../api/trips";

export default function TripSettingsPage() {
  const theme = useTheme();
  const { trips, activeTripId, refreshTrips, addTrip, removeTripLocal } = useTrip();
  const { profile } = useUser();
  const { getSettings, loadSettings, saveSettings } = useTripSettings();

  const trip = useMemo(() => trips.find((t) => t.tripId === activeTripId), [trips, activeTripId]);
  const settings = activeTripId ? getSettings(activeTripId) : null;

  useEffect(() => { if (activeTripId) loadSettings(activeTripId); }, [activeTripId]);

  // ── Rename ──────────────────────────────────────────────────────────────────
  const [renamingTrip, setRenamingTrip] = useState(false);
  const [tripNameInput, setTripNameInput] = useState(trip?.name ?? "");
  const [renameLoading, setRenameLoading] = useState(false);
  const [renameMsg, setRenameMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  useEffect(() => { setTripNameInput(trip?.name ?? ""); }, [trip]);

  const handleRename = async () => {
    if (!activeTripId || !tripNameInput.trim()) return;
    setRenameLoading(true); setRenameMsg(null);
    try {
      await renameTripApi(activeTripId, tripNameInput.trim());
      await refreshTrips();
      setRenamingTrip(false);
      setRenameMsg({ type: "success", text: "Trip renamed." });
    } catch (e: any) {
      setRenameMsg({ type: "error", text: e?.message ?? "Failed to rename." });
    } finally { setRenameLoading(false); }
  };

  // ── People ──────────────────────────────────────────────────────────────────
  const [people, setPeople] = useState<string[]>(settings?.people ?? []);
  const [newPerson, setNewPerson] = useState("");
  const [peopleMsg, setPeopleMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [peopleSaving, setPeopleSaving] = useState(false);

  useEffect(() => {
    if (!settings) return;
    let base = settings.people ?? [];
    if (profile?.firstName && !base.includes(profile.firstName)) base = [profile.firstName, ...base];
    setPeople(base);
  }, [settings?.people?.join(","), profile?.firstName]);

  const addPerson = () => {
    const trimmed = newPerson.trim();
    if (!trimmed) return;
    if (people.map((p) => p.toLowerCase()).includes(trimmed.toLowerCase())) {
      setPeopleMsg({ type: "error", text: "That name is already in the list." }); return;
    }
    setPeople((prev) => [...prev, trimmed]);
    setNewPerson(""); setPeopleMsg(null);
  };

  const savePeople = async () => {
    if (!activeTripId) return;
    setPeopleSaving(true); setPeopleMsg(null);
    try {
      await saveSettings(activeTripId, { people });
      setPeopleMsg({ type: "success", text: "People list saved." });
    } catch (e: any) {
      setPeopleMsg({ type: "error", text: e?.message ?? "Failed to save." });
    } finally { setPeopleSaving(false); }
  };

  // ── Categories ──────────────────────────────────────────────────────────────
  const [categories, setCategories] = useState<string[]>(settings?.categories ?? []);
  const [newCategory, setNewCategory] = useState("");
  const [catMsg, setCatMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [catSaving, setCatSaving] = useState(false);
  useEffect(() => { if (settings?.categories) setCategories(settings.categories); }, [settings?.categories?.join(",")]);

  const saveCategories = async () => {
    if (!activeTripId) return;
    setCatSaving(true); setCatMsg(null);
    try {
      await saveSettings(activeTripId, { categories });
      setCatMsg({ type: "success", text: "Categories saved." });
    } catch (e: any) {
      setCatMsg({ type: "error", text: e?.message ?? "Failed to save." });
    } finally { setCatSaving(false); }
  };

  // ── Budget ──────────────────────────────────────────────────────────────────
  const [totalInput, setTotalInput] = useState(settings?.totalBudgetCents ? (settings.totalBudgetCents / 100).toFixed(0) : "");
  const [catBudgets, setCatBudgets] = useState(settings?.categoryBudgets.map((cb) => ({ category: cb.category, input: (cb.limitCents / 100).toFixed(0) })) ?? []);
  const [newBudgetCat, setNewBudgetCat] = useState("");
  const [budgetMsg, setBudgetMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [budgetSaving, setBudgetSaving] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setTotalInput(settings.totalBudgetCents ? (settings.totalBudgetCents / 100).toFixed(0) : "");
    setCatBudgets(settings.categoryBudgets.map((cb) => ({ category: cb.category, input: (cb.limitCents / 100).toFixed(0) })));
  }, [settings?.totalBudgetCents, settings?.categoryBudgets?.length]);

  useEffect(() => {
    const available = categories.filter((c) => !catBudgets.find((cb) => cb.category === c));
    if (available.length > 0 && !newBudgetCat) setNewBudgetCat(available[0]);
  }, [categories]);

  const saveBudget = async () => {
    if (!activeTripId) return;
    setBudgetSaving(true); setBudgetMsg(null);
    try {
      const total = totalInput.trim() === "" ? null : Number(totalInput);
      if (total !== null && (!Number.isFinite(total) || total < 0)) {
        setBudgetMsg({ type: "error", text: "Invalid total budget." }); return;
      }
      const categoryBudgets = catBudgets.map((cb) => ({ category: cb.category, limitCents: Math.round(Number(cb.input) * 100) }));
      await saveSettings(activeTripId, { totalBudgetCents: total !== null ? Math.round(total * 100) : null, categoryBudgets });
      setBudgetMsg({ type: "success", text: "Budget saved." });
    } catch (e: any) {
      setBudgetMsg({ type: "error", text: e?.message ?? "Failed to save." });
    } finally { setBudgetSaving(false); }
  };

  const availableBudgetCats = categories.filter((c) => !catBudgets.find((cb) => cb.category === c));

  // ── Members ──────────────────────────────────────────────────────────────────
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [removingMember, setRemovingMember] = useState<string | null>(null);

  const handleInvite = async () => {
    if (!activeTripId || !inviteEmail.trim()) return;
    setInviteLoading(true); setInviteMsg(null);
    try {
      await inviteTripMember(activeTripId, inviteEmail.trim());
      setInviteEmail("");
      setInviteMsg({ type: "success", text: "Invite sent!" });
      await loadSettings(activeTripId);
    } catch (e: any) {
      setInviteMsg({ type: "error", text: e?.message ?? "Failed to send invite." });
    } finally { setInviteLoading(false); }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!activeTripId) return;
    setRemovingMember(userId);
    try { await removeTripMember(activeTripId, userId); await loadSettings(activeTripId); }
    catch { /* silently fail */ }
    finally { setRemovingMember(null); }
  };

  // ── Create Trip ──────────────────────────────────────────────────────────────
  const [newTripName, setNewTripName] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createMsg, setCreateMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleCreateTrip = async () => {
    if (!newTripName.trim()) { setCreateMsg({ type: "error", text: "Please enter a trip name." }); return; }
    setCreateLoading(true); setCreateMsg(null);
    try {
      await addTrip(newTripName.trim());
      setNewTripName("");
      setCreateMsg({ type: "success", text: "Trip created!" });
    } catch (e: any) {
      setCreateMsg({ type: "error", text: e?.message ?? "Failed to create trip." });
    } finally { setCreateLoading(false); }
  };

  // ── Delete Trip ──────────────────────────────────────────────────────────────
  const [deleteTripId, setDeleteTripId] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [tripDeleting, setTripDeleting] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const deleteTripLabel = useMemo(() => trips.find((t) => t.tripId === deleteTripId)?.name ?? "", [trips, deleteTripId]);
  const confirmOk = deleteConfirmText.trim().toUpperCase() === "CONFIRM";

  const handleConfirmDeleteTrip = async () => {
    if (!deleteTripId) return;
    setTripDeleting(true); setDeleteMsg(null);
    try {
      await deleteTrip(deleteTripId);
      removeTripLocal(deleteTripId);
      setDeleteTripId(""); setDeleteMsg({ type: "success", text: "Trip deleted." });
      setDeleteDialogOpen(false);
    } catch (e: any) {
      setDeleteMsg({ type: "error", text: e?.message ?? "Failed to delete trip." });
    } finally { setTripDeleting(false); }
  };

  if (!activeTripId) return (
    <Stack spacing={2}>
      <Typography variant="h5" fontWeight={800}>Trip Settings</Typography>
      <Alert severity="info">Select a trip from the top bar first.</Alert>
    </Stack>
  );

  return (
    <Box>
      <Stack spacing={2}>
        <Typography variant="h5" fontWeight={800}>Trip Settings — {trip?.name}</Typography>

        {/* ── Two column grid on desktop ── */}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 2, alignItems: "start" }}>

          {/* ── LEFT COLUMN ── */}
          <Stack spacing={2}>

            {/* Rename */}
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={800}>Trip Name</Typography>
                <Divider sx={{ my: 1.5 }} />
                {renameMsg && <Alert severity={renameMsg.type} sx={{ mb: 1.5 }}>{renameMsg.text}</Alert>}
                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField value={tripNameInput} onChange={(e) => setTripNameInput(e.target.value)}
                    disabled={!renamingTrip || renameLoading} fullWidth size="small" />
                  {!renamingTrip ? (
                    <Button startIcon={<EditOutlinedIcon />} onClick={() => setRenamingTrip(true)} variant="outlined" size="small">
                      Rename
                    </Button>
                  ) : (
                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title="Save">
                        <IconButton color="primary" onClick={handleRename} disabled={renameLoading || !tripNameInput.trim()}>
                          {renameLoading ? <CircularProgress size={18} /> : <CheckIcon />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Cancel">
                        <IconButton onClick={() => { setRenamingTrip(false); setTripNameInput(trip?.name ?? ""); }}>
                          <CloseIcon />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  )}
                </Stack>
              </CardContent>
            </Card>

            {/* People */}
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={800}>People on this Trip</Typography>
                <Typography variant="body2" sx={{ opacity: 0.7, mt: 0.5 }}>
                  These names populate the "Who Paid" dropdown when adding expenses.
                </Typography>
                <Divider sx={{ my: 1.5 }} />
                {peopleMsg && <Alert severity={peopleMsg.type} sx={{ mb: 1.5 }}>{peopleMsg.text}</Alert>}
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
                  {people.map((person) => (
                    <Chip key={person} label={person} onDelete={() => setPeople((prev) => prev.filter((p) => p !== person))}
                      sx={{ fontWeight: 600, bgcolor: alpha(theme.palette.primary.main, 0.1),
                        "& .MuiChip-deleteIcon": { color: theme.palette.error.main } }} />
                  ))}
                  {people.length === 0 && <Typography variant="body2" sx={{ opacity: 0.6 }}>No people added yet.</Typography>}
                </Box>
                <Stack direction="row" spacing={1}>
                  <TextField label="Add a person" value={newPerson} onChange={(e) => setNewPerson(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") addPerson(); }} size="small" fullWidth placeholder="e.g. Sam" />
                  <Button variant="outlined" startIcon={<AddCircleOutlineIcon />} onClick={addPerson} disabled={!newPerson.trim()}>Add</Button>
                </Stack>
                <Button variant="contained" onClick={savePeople} disabled={peopleSaving} sx={{ mt: 2 }} fullWidth>
                  {peopleSaving ? <CircularProgress size={18} color="inherit" /> : "Save People"}
                </Button>
              </CardContent>
            </Card>

            {/* Members */}
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={800}>Trip Members</Typography>
                <Typography variant="body2" sx={{ opacity: 0.7, mt: 0.5 }}>
                  Invite someone by email to share this trip.
                </Typography>
                <Divider sx={{ my: 1.5 }} />
                {inviteMsg && <Alert severity={inviteMsg.type} sx={{ mb: 1.5 }}>{inviteMsg.text}</Alert>}
                {settings?.members && settings.members.length > 0 && (
                  <Stack spacing={1} sx={{ mb: 2 }}>
                    {settings.members.map((m) => (
                      <Stack key={m.userId} direction="row" alignItems="center" justifyContent="space-between"
                        sx={{ px: 1.5, py: 1, borderRadius: 2,
                          bgcolor: alpha(theme.palette.primary.main, 0.05),
                          border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}` }}>
                        <Stack>
                          <Typography variant="body2" fontWeight={700}>{m.email}</Typography>
                          <Typography variant="caption" sx={{ opacity: 0.6, textTransform: "capitalize" }}>{m.role}</Typography>
                        </Stack>
                        {m.role !== "owner" && (
                          <Tooltip title="Remove member">
                            <IconButton size="small" color="error" onClick={() => handleRemoveMember(m.userId)}
                              disabled={removingMember === m.userId}>
                              {removingMember === m.userId ? <CircularProgress size={16} /> : <DeleteOutlineIcon fontSize="small" />}
                            </IconButton>
                          </Tooltip>
                        )}
                      </Stack>
                    ))}
                  </Stack>
                )}
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <TextField label="Email address" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleInvite(); }}
                    type="email" size="small" fullWidth disabled={inviteLoading} />
                  <Button variant="contained"
                    startIcon={inviteLoading ? <CircularProgress size={16} color="inherit" /> : <PersonAddOutlinedIcon />}
                    onClick={handleInvite} disabled={inviteLoading || !inviteEmail.trim()}>
                    Invite
                  </Button>
                </Stack>
              </CardContent>
            </Card>

          </Stack>

          {/* ── RIGHT COLUMN ── */}
          <Stack spacing={2}>

            {/* Categories */}
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={800}>Expense Categories</Typography>
                <Typography variant="body2" sx={{ opacity: 0.7, mt: 0.5 }}>
                  Customize the categories for this trip.
                </Typography>
                <Divider sx={{ my: 1.5 }} />
                {catMsg && <Alert severity={catMsg.type} sx={{ mb: 1.5 }}>{catMsg.text}</Alert>}
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
                  {categories.map((cat) => (
                    <Chip key={cat} label={cat}
                      onDelete={() => setCategories((prev) => prev.filter((c) => c !== cat))}
                      sx={{ fontWeight: 600, bgcolor: alpha(theme.palette.primary.main, 0.1),
                        "& .MuiChip-deleteIcon": { color: theme.palette.error.main } }} />
                  ))}
                  {categories.length === 0 && <Typography variant="body2" sx={{ opacity: 0.6 }}>No categories yet.</Typography>}
                </Box>
                <Stack direction="row" spacing={1}>
                  <TextField label="New category" value={newCategory} onChange={(e) => setNewCategory(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { const t = newCategory.trim(); if (!t) return; setCategories((p) => [...p, t]); setNewCategory(""); } }}
                    size="small" fullWidth />
                  <Button variant="outlined" startIcon={<AddCircleOutlineIcon />}
                    onClick={() => { const t = newCategory.trim(); if (!t) return; setCategories((p) => [...p, t]); setNewCategory(""); }}
                    disabled={!newCategory.trim()}>Add</Button>
                </Stack>
                <Button variant="contained" onClick={saveCategories} disabled={catSaving} sx={{ mt: 2 }} fullWidth>
                  {catSaving ? <CircularProgress size={18} color="inherit" /> : "Save Categories"}
                </Button>
              </CardContent>
            </Card>

            {/* Budget */}
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={800}>Budget</Typography>
                <Typography variant="body2" sx={{ opacity: 0.7, mt: 0.5 }}>
                  Set a total and/or per-category limits.
                </Typography>
                <Divider sx={{ my: 1.5 }} />
                {budgetMsg && <Alert severity={budgetMsg.type} sx={{ mb: 1.5 }}>{budgetMsg.text}</Alert>}
                <Stack spacing={2}>
                  <TextField label="Total trip budget (optional)" value={totalInput} onChange={(e) => setTotalInput(e.target.value)}
                    type="number" inputProps={{ min: 0, step: "1" }} size="small" fullWidth placeholder="e.g. 2000"
                    InputProps={{ startAdornment: <Typography sx={{ mr: 0.5, opacity: 0.6 }}>$</Typography> }} />
                  {catBudgets.length > 0 && (
                    <>
                      <Divider />
                      <Typography variant="body2" fontWeight={700}>Per-category limits</Typography>
                      {catBudgets.map((cb) => (
                        <Stack key={cb.category} direction="row" spacing={1} alignItems="center">
                          <Typography variant="body2" sx={{ minWidth: 120, fontWeight: 600 }}>{cb.category}</Typography>
                          <TextField value={cb.input}
                            onChange={(e) => setCatBudgets((prev) => prev.map((x) => x.category === cb.category ? { ...x, input: e.target.value } : x))}
                            type="number" inputProps={{ min: 0, step: "1" }} size="small" fullWidth placeholder="$" />
                          <IconButton size="small" color="error"
                            onClick={() => setCatBudgets((prev) => prev.filter((x) => x.category !== cb.category))}>
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      ))}
                    </>
                  )}
                  {availableBudgetCats.length > 0 && (
                    <Stack direction="row" spacing={1}>
                      <TextField select value={newBudgetCat} onChange={(e) => setNewBudgetCat(e.target.value)} size="small" sx={{ flex: 1 }} label="Category">
                        {availableBudgetCats.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                      </TextField>
                      <Button variant="outlined" startIcon={<AddCircleOutlineIcon />}
                        onClick={() => { if (!newBudgetCat) return; setCatBudgets((prev) => [...prev, { category: newBudgetCat, input: "" }]); const r = availableBudgetCats.filter((c) => c !== newBudgetCat); setNewBudgetCat(r[0] ?? ""); }}
                        disabled={!newBudgetCat}>Add</Button>
                    </Stack>
                  )}
                  <Button variant="contained" onClick={saveBudget} disabled={budgetSaving} fullWidth>
                    {budgetSaving ? <CircularProgress size={18} color="inherit" /> : "Save Budget"}
                  </Button>
                </Stack>
              </CardContent>
            </Card>

            {/* Create + Delete trips */}
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={800}>Manage Trips</Typography>
                <Divider sx={{ my: 1.5 }} />

                {/* Create */}
                <Typography variant="body2" fontWeight={700} sx={{ mb: 1 }}>Create a New Trip</Typography>
                {createMsg && <Alert severity={createMsg.type} sx={{ mb: 1.5 }}>{createMsg.text}</Alert>}
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 2 }}>
                  <TextField label="Trip name" value={newTripName} onChange={(e) => setNewTripName(e.target.value)}
                    fullWidth disabled={createLoading} size="small" />
                  <Button variant="contained" onClick={handleCreateTrip} disabled={createLoading || !newTripName.trim()}>
                    {createLoading ? <CircularProgress size={18} color="inherit" /> : "Create"}
                  </Button>
                </Stack>

                <Divider sx={{ my: 2 }} />

                {/* Delete */}
                <Typography variant="body2" fontWeight={700} color="error" sx={{ mb: 1 }}>Delete a Trip</Typography>
                <Typography variant="body2" sx={{ opacity: 0.7, mb: 1.5 }}>
                  Permanently deletes the trip and all its expenses.
                </Typography>
                {deleteMsg && <Alert severity={deleteMsg.type} sx={{ mb: 1.5 }}>{deleteMsg.text}</Alert>}
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <TextField select label="Trip to delete" value={deleteTripId}
                    onChange={(e) => setDeleteTripId(e.target.value)} fullWidth disabled={tripDeleting} size="small">
                    <MenuItem value=""><em>Select a trip…</em></MenuItem>
                    {trips.map((t) => <MenuItem key={t.tripId} value={t.tripId}>{t.name}</MenuItem>)}
                  </TextField>
                  <Button color="error" variant="contained" startIcon={<DeleteOutlineIcon />}
                    onClick={() => { setDeleteConfirmText(""); setDeleteDialogOpen(true); }}
                    disabled={tripDeleting || !deleteTripId}>
                    Delete
                  </Button>
                </Stack>
              </CardContent>
            </Card>

          </Stack>
        </Box>
      </Stack>

      {/* Delete dialog */}
      <Dialog open={deleteDialogOpen} onClose={tripDeleting ? undefined : () => setDeleteDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Delete trip?</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <Alert severity="warning">
              Permanently deletes <b>{deleteTripLabel || "this trip"}</b> and all its expenses. Cannot be undone.
            </Alert>
            <Typography variant="body2">Type <b>CONFIRM</b> to proceed.</Typography>
            <TextField autoFocus label="Type CONFIRM" value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)} disabled={tripDeleting} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={tripDeleting}>Cancel</Button>
          <Button color="error" variant="contained"
            startIcon={tripDeleting ? <CircularProgress size={18} color="inherit" /> : <DeleteOutlineIcon />}
            onClick={handleConfirmDeleteTrip} disabled={!confirmOk || tripDeleting}>
            {tripDeleting ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}