import { useEffect, useMemo, useState } from "react";
import {
  Alert,
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
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import SearchIcon from "@mui/icons-material/Search";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";
import { useTheme, alpha } from "@mui/material/styles";
import { useTrip } from "../context/TripContext";
import { getExpenses, deleteExpense, type Expense } from "../api/expenses";
import ExpenseEditDialog from "../components/ExpenseEditDialog";

const CATEGORIES = [
  "All",
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

function formatMoneyFromCents(cents: number) {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export default function AllExpenses() {
  const { trips, activeTripId, loadingTrips } = useTrip();
  const navigate = useNavigate();
  const theme = useTheme();

  const activeTripName = useMemo(
    () => trips.find((t) => t.tripId === activeTripId)?.name ?? "Trip",
    [trips, activeTripId]
  );

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [payerFilter, setPayerFilter] = useState("All");

  // Edit
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (loadingTrips || !activeTripId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getExpenses(activeTripId)
      .then((d) => setExpenses(d.expenses ?? []))
      .catch((e: any) => setError(e?.message ?? "Failed to load expenses"))
      .finally(() => setLoading(false));
  }, [activeTripId, loadingTrips]);

  const allPayers = useMemo(() => {
    const set = new Set(expenses.map((e) => e.whoPaid));
    return ["All", ...Array.from(set).sort()];
  }, [expenses]);

  const filtered = useMemo(() => {
    return expenses
      .filter((e) => {
        const q = search.toLowerCase();
        if (q && !e.description.toLowerCase().includes(q) && !e.whoPaid.toLowerCase().includes(q))
          return false;
        if (categoryFilter !== "All" && e.category !== categoryFilter) return false;
        if (payerFilter !== "All" && e.whoPaid !== payerFilter) return false;
        return true;
      })
      .sort((a, b) => {
        const ak = a.createdAt ?? `${a.date}T00:00:00.000Z`;
        const bk = b.createdAt ?? `${b.date}T00:00:00.000Z`;
        return bk.localeCompare(ak);
      });
  }, [expenses, search, categoryFilter, payerFilter]);

  const handleSaved = (updated: Expense) => {
    setExpenses((prev) => prev.map((e) => (e.expenseId === updated.expenseId ? updated : e)));
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteExpense(deleteTarget.expenseId);
      setExpenses((prev) => prev.filter((e) => e.expenseId !== deleteTarget.expenseId));
      setDeleteTarget(null);
    } catch (e: any) {
      setDeleteError(e?.message ?? "Failed to delete expense.");
    } finally {
      setDeleting(false);
    }
  };

  if (!loadingTrips && !activeTripId) {
    return (
      <Stack spacing={2}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/")} sx={{ alignSelf: "flex-start" }}>
          Back to Summary
        </Button>
        <Alert severity="info">No trip selected. Pick a trip from the top bar.</Alert>
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
          All Expenses — {activeTripName}
        </Typography>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

      {/* Filters */}
      <Card>
        <CardContent>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField
              placeholder="Search description or person…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              size="small"
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              select
              label="Category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              size="small"
              sx={{ minWidth: 160 }}
            >
              {CATEGORIES.map((c) => (
                <MenuItem key={c} value={c}>
                  {c}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Who Paid"
              value={payerFilter}
              onChange={(e) => setPayerFilter(e.target.value)}
              size="small"
              sx={{ minWidth: 140 }}
            >
              {allPayers.map((p) => (
                <MenuItem key={p} value={p}>
                  {p}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </CardContent>
      </Card>

      {loading || loadingTrips ? (
        <Box sx={{ display: "grid", placeItems: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : filtered.length === 0 ? (
        <Alert severity="info">No expenses match your filters.</Alert>
      ) : (
        <Card>
          <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
            <Box sx={{ px: 2, pt: 2, pb: 1 }}>
              <Typography variant="body2" sx={{ opacity: 0.65 }}>
                {filtered.length} expense{filtered.length !== 1 ? "s" : ""} shown
              </Typography>
            </Box>
            <Divider />
            <TableContainer component={Paper} elevation={0} sx={{ bgcolor: "transparent" }}>
              <Table size="small" sx={{ minWidth: 640 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Who Paid</TableCell>
                    <TableCell align="right">Cost</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.map((e) => (
                    <TableRow
                      key={e.expenseId}
                      sx={{
                        "&:hover": {
                          bgcolor: alpha(theme.palette.primary.main, 0.04),
                        },
                      }}
                    >
                      <TableCell sx={{ whiteSpace: "nowrap" }}>{e.date}</TableCell>
                      <TableCell>{e.description}</TableCell>
                      <TableCell>
                        <Chip size="small" label={e.category} />
                      </TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>{e.whoPaid}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: "nowrap", fontWeight: 600 }}>
                        {formatMoneyFromCents(e.costCents ?? 0)}
                      </TableCell>
                      <TableCell align="center">
                        <Stack direction="row" spacing={0.5} justifyContent="center">
                          <Tooltip title="Edit">
                            <IconButton
                              size="small"
                              onClick={() => {
                                setEditExpense(e);
                                setEditOpen(true);
                              }}
                            >
                              <EditOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => {
                                setDeleteError(null);
                                setDeleteTarget(e);
                              }}
                            >
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Edit dialog */}
      <ExpenseEditDialog
        expense={editExpense}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={handleSaved}
      />

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!deleteTarget}
        onClose={deleting ? undefined : () => setDeleteTarget(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Delete expense?</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5}>
            <Alert severity="warning">
              <b>{deleteTarget?.description}</b> ({deleteTarget?.date}) will be permanently deleted.
            </Alert>
            {deleteError && <Alert severity="error">{deleteError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleDeleteConfirm}
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} color="inherit" /> : <DeleteOutlineIcon />}
          >
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}