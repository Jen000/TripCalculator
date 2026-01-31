import type { ReactNode } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Container,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { useTrip } from "../context/TripContext";

type Props = {
  children: ReactNode;
  onLogout: () => void;
  user: any;
};


export default function Layout({ children, onLogout, user }: Props) {
  const { trips, activeTripId, setActiveTripId, loadingTrips } = useTrip();
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#f5f5f5" }}>
      <AppBar position="static">
        <Toolbar sx={{ gap: 1 }}>
          <Typography variant="body2" sx={{ mr: 2, opacity: 0.9 }}>
            {user?.signInDetails?.loginId ?? user?.username}
          </Typography>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Trip Expense Tracker
          </Typography>
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>Trip</InputLabel>
            <Select
              label="Trip"
              value={activeTripId || ""}
              onChange={(e) => setActiveTripId(String(e.target.value))}
              disabled={loadingTrips || trips.length === 0}
            >
              {trips.map((t) => (
                <MenuItem key={t.tripId} value={t.tripId}>
                  {t.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button color="inherit" component={RouterLink} to="/">
            Summary
          </Button>
          <Button color="inherit" component={RouterLink} to="/expenses">
            Add Expense
          </Button>
          <Button color="inherit" component={RouterLink} to="/settings">
            Settings
          </Button>

          <Button color="inherit" onClick={onLogout}>
            Logout
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="sm" sx={{ mt: 4 }}>
        {children}
      </Container>
    </Box>
  );
}
