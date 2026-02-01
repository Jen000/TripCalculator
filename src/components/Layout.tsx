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
import { useTheme, alpha } from "@mui/material/styles";
import MenuIcon from "@mui/icons-material/Menu";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import { useNavigate, useLocation } from "react-router-dom";
import { useTrip } from "../context/TripContext";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";

type Props = {
  children: ReactNode;
  onLogout: () => void;
  user: any;
  mode: "light" | "dark";
  onToggleMode: () => void;
};

export default function Layout({ children, onLogout, user, mode, onToggleMode }: Props) {
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

  const activeBg = alpha("#fff", 0.18);
  const hoverBg = alpha("#fff", 0.12);

  const navIconSx = (active: boolean) => ({
    borderRadius: 2,
    color: "inherit",
    bgcolor: active ? activeBg : "transparent",
    "&:hover": { bgcolor: hoverBg },
  });

  const topActions = (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <Tooltip title="Summary">
        <IconButton
          onClick={() => go("/")}
          aria-label="Summary"
          size="large"
          sx={navIconSx(location.pathname === "/")}
        >
          <DescriptionOutlinedIcon />
        </IconButton>
      </Tooltip>

      <Tooltip title="Add expense">
        <IconButton
          onClick={() => go("/expenses")}
          aria-label="Add expense"
          size="large"
          sx={navIconSx(location.pathname === "/expenses")}
        >
          <AddCircleOutlineIcon />
        </IconButton>
      </Tooltip>

      <Tooltip title={mode === "dark" ? "Light mode" : "Dark mode"}>
        <IconButton
          onClick={onToggleMode}
          aria-label="Toggle theme"
          size="large"
          sx={{
            borderRadius: 2,
            "&:hover": { bgcolor: alpha(theme.palette.common.white, 0.12) },
          }}
        >
          {mode === "dark" ? <LightModeOutlinedIcon /> : <DarkModeOutlinedIcon />}
        </IconButton>
      </Tooltip>

      <Tooltip title="Menu">
        <IconButton
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          size="large"
          sx={{
            borderRadius: 2,
            color: "inherit", // ✅ makes icon match AppBar text/icon color
            "&:hover": { bgcolor: alpha(theme.palette.common.white, 0.12) },
          }}
        >
          <MenuIcon />
        </IconButton>
      </Tooltip>
    </Stack>
  );

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === "light" ? 0.06 : 0.10),
          borderRadius: 2,
        }}
      >
        <Toolbar sx={{ gap: 1, py: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, flexGrow: 1 }}>
            Trip Expense Tracker
          </Typography>

          {!isMobile && (
            <FormControl size="small" sx={{ minWidth: 240 }}>
              <InputLabel id="trip-select-label" sx={{ color: alpha("#fff", 0.85) }}>
                Trip
              </InputLabel>
              <Select
                labelId="trip-select-label"
                label="Trip"
                value={activeTripId ?? ""}
                onChange={(e) => {
                  const v = String(e.target.value);
                  setActiveTripId(v ? v : null);
                }}
                disabled={loadingTrips || trips.length === 0}
                sx={{
                  color: "#fff",
                  ".MuiOutlinedInput-notchedOutline": {
                    borderColor: alpha("#fff", 0.35),
                  },
                  "&:hover .MuiOutlinedInput-notchedOutline": {
                    borderColor: alpha("#fff", 0.55),
                  },
                  "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                    borderColor: alpha("#fff", 0.7),
                  },
                  ".MuiSvgIcon-root": { color: alpha("#fff", 0.85) },
                }}
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

          {topActions}
        </Toolbar>
      </AppBar>

      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: 320,
            maxWidth: "85vw",
            bgcolor: "background.paper",
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="overline" sx={{ opacity: 0.7 }}>
            Signed in as
          </Typography>
          <Typography variant="body1" fontWeight={700} sx={{ wordBreak: "break-word" }}>
            {username}
          </Typography>

          <Divider sx={{ my: 2 }} />

          {isMobile && (
            <Stack spacing={1.5}>
              <Typography variant="overline" sx={{ opacity: 0.7 }}>
                Trip
              </Typography>

              <FormControl fullWidth size="small" sx= {{}}>
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

          <List disablePadding sx={{ mt: 1 }}>
            <ListItemButton
              selected={location.pathname === "/"}
              onClick={() => go("/")}
              sx={{
                borderRadius: 2,
                mb: 0.5,
                "&.Mui-selected": {
                  bgcolor: alpha(theme.palette.primary.main, 0.14),
                },
                "&.Mui-selected:hover": {
                  bgcolor: alpha(theme.palette.primary.main, 0.2),
                },
              }}
            >
              <ListItemIcon>
                <DescriptionOutlinedIcon />
              </ListItemIcon>
              <ListItemText primary="Summary" />
            </ListItemButton>

            <ListItemButton
              selected={location.pathname === "/expenses"}
              onClick={() => go("/expenses")}
              sx={{
                borderRadius: 2,
                mb: 0.5,
                "&.Mui-selected": {
                  bgcolor: alpha(theme.palette.primary.main, 0.14),
                },
                "&.Mui-selected:hover": {
                  bgcolor: alpha(theme.palette.primary.main, 0.2),
                },
              }}
            >
              <ListItemIcon>
                <AddCircleOutlineIcon />
              </ListItemIcon>
              <ListItemText primary="Add Expense" />
            </ListItemButton>

            <ListItemButton
              selected={location.pathname === "/settings"}
              onClick={() => go("/settings")}
              sx={{
                borderRadius: 2,
                mb: 0.5,
                "&.Mui-selected": {
                  bgcolor: alpha(theme.palette.primary.main, 0.14),
                },
                "&.Mui-selected:hover": {
                  bgcolor: alpha(theme.palette.primary.main, 0.2),
                },
              }}
            >
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
              sx={{
                borderRadius: 2,
                color: "error.main",
                "&:hover": { bgcolor: alpha(theme.palette.error.main, 0.08) },
              }}
            >
              <ListItemIcon sx={{ color: "inherit" }}>
                <LogoutOutlinedIcon />
              </ListItemIcon>
              <ListItemText primary="Logout" />
            </ListItemButton>
          </List>
        </Box>
      </Drawer>

      <Container maxWidth="sm" sx={{ mt: 2, pb: 4, px: { xs: 1.5, sm: 2 } }}>
        {children}
      </Container>
    </Box>
  );
}
