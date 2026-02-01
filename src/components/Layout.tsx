import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
  Container,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tooltip,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import MenuIcon from "@mui/icons-material/Menu";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import { useNavigate, useLocation } from "react-router-dom";
import { useTrip } from "../context/TripContext";

type Props = {
  children: ReactNode;
  onLogout: () => void;
  user: any;
};

export default function Layout({ children, onLogout, user }: Props) {
  const { trips, activeTripId, setActiveTripId, loadingTrips } = useTrip();

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const navigate = useNavigate();
  const location = useLocation();

  const [drawerOpen, setDrawerOpen] = useState(false);

  const username = useMemo(() => {
    return user?.signInDetails?.loginId ?? user?.username ?? "Signed in";
  }, [user]);

  const activeTripName = useMemo(() => {
    return trips.find((t) => t.tripId === activeTripId)?.name ?? "No trip selected";
  }, [trips, activeTripId]);

  const go = (path: string) => {
    navigate(path);
    setDrawerOpen(false);
  };

  const topActions = (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <Tooltip title="Summary">
        <IconButton
          color="inherit"
          onClick={() => go("/")}
          aria-label="Summary"
          size="large"
          sx={{
            bgcolor: location.pathname === "/" ? "rgba(255,255,255,0.14)" : "transparent",
            borderRadius: 2,
          }}
        >
          <DescriptionOutlinedIcon />
        </IconButton>
      </Tooltip>

      <Tooltip title="Add expense">
        <IconButton
          color="inherit"
          onClick={() => go("/expenses")}
          aria-label="Add expense"
          size="large"
          sx={{
            bgcolor: location.pathname === "/expenses" ? "rgba(255,255,255,0.14)" : "transparent",
            borderRadius: 2,
          }}
        >
          <AddCircleOutlineIcon />
        </IconButton>
      </Tooltip>

      <Tooltip title="Menu">
        <IconButton
          color="inherit"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          size="large"
        >
          <MenuIcon />
        </IconButton>
      </Tooltip>
    </Stack>
  );

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#f5f5f5" }}>
      <AppBar position="sticky" elevation={1}>
        <Toolbar sx={{ gap: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, flexGrow: 1 }}>
            Trip Expense Tracker
          </Typography>

          {/* Desktop: show trip selector inline */}
          {!isMobile && (
            <FormControl size="small" sx={{ minWidth: 240 }}>
              <InputLabel id="trip-select-label">Trip</InputLabel>
              <Select
                labelId="trip-select-label"
                label="Trip"
                value={activeTripId ?? ""}
                onChange={(e) => {
                  const v = String(e.target.value);
                  setActiveTripId(v ? v : null);
                }}
                disabled={loadingTrips || trips.length === 0}
              >
                <MenuItem value="">
                  <em>No trip</em>
                </MenuItem>
                {trips.map((t) => (
                  <MenuItem key={t.tripId} value={t.tripId}>
                    {t.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Right side */}
          {topActions}
        </Toolbar>
      </AppBar>

      {/* Drawer */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{ sx: { width: 320, maxWidth: "85vw" } }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="overline" sx={{ opacity: 0.7 }}>
            Signed in as
          </Typography>
          <Typography variant="body1" fontWeight={700} sx={{ wordBreak: "break-word" }}>
            {username}
          </Typography>

          <Divider sx={{ my: 2 }} />

          {/* Mobile: trip selector goes here */}
          {isMobile && (
            <Stack spacing={1.5}>
              <Typography variant="overline" sx={{ opacity: 0.7 }}>
                Trip
              </Typography>

              <FormControl fullWidth size="small">
                <InputLabel id="trip-select-drawer">Trip</InputLabel>
                <Select
                  labelId="trip-select-drawer"
                  label="Trip"
                  value={activeTripId ?? ""}
                  onChange={(e) => {
                    const v = String(e.target.value);
                    setActiveTripId(v ? v : null);
                  }}
                  disabled={loadingTrips || trips.length === 0}
                >
                  <MenuItem value="">
                    <em>No trip</em>
                  </MenuItem>
                  {trips.map((t) => (
                    <MenuItem key={t.tripId} value={t.tripId}>
                      {t.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Typography variant="caption" sx={{ opacity: 0.75 }}>
                Current: <b>{activeTripName}</b>
              </Typography>

              <Divider />
            </Stack>
          )}

          <List disablePadding>
            <ListItemButton onClick={() => go("/")}>
              <ListItemIcon>
                <DescriptionOutlinedIcon />
              </ListItemIcon>
              <ListItemText primary="Summary" />
            </ListItemButton>

            <ListItemButton onClick={() => go("/expenses")}>
              <ListItemIcon>
                <AddCircleOutlineIcon />
              </ListItemIcon>
              <ListItemText primary="Add Expense" />
            </ListItemButton>

            <ListItemButton onClick={() => go("/settings")}>
              <ListItemIcon>
                <SettingsOutlinedIcon />
              </ListItemIcon>
              <ListItemText primary="Settings" />
            </ListItemButton>
          </List>

          <Divider sx={{ my: 2 }} />

          <List disablePadding>
            <ListItemButton
              onClick={() => {
                setDrawerOpen(false);
                onLogout();
              }}
            >
              <ListItemIcon>
                <LogoutOutlinedIcon />
              </ListItemIcon>
              <ListItemText primary="Logout" />
            </ListItemButton>
          </List>
        </Box>
      </Drawer>

      {/* Page container */}
      <Container maxWidth="sm" sx={{ mt: 2, pb: 4 , px: { xs: 1.5, sm: 2} }}>
        {children}
      </Container>
    </Box>
  );
}
