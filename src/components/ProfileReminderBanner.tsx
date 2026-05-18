import { useState } from "react";
import { Alert, Link } from "@mui/material";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { useUser } from "../context/UserContext";

const DISMISS_KEY = "profileReminderDismissed";

export function isFirstNameMissing(
  profile: { firstName: string | null } | null,
): boolean {
  if (!profile) return false;
  return !profile.firstName || !profile.firstName.trim();
}

export default function ProfileReminderBanner() {
  const { profile, loadingProfile } = useUser();
  const location = useLocation();
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem(DISMISS_KEY) === "1",
  );

  if (loadingProfile) return null;
  if (!isFirstNameMissing(profile)) return null;
  if (dismissed) return null;
  if (location.pathname === "/settings") return null;

  return (
    <Alert
      severity="info"
      onClose={() => {
        sessionStorage.setItem(DISMISS_KEY, "1");
        setDismissed(true);
      }}
      sx={{
        mb: 2,
        borderRadius: 2,
        py: 1.25,
        alignItems: "center",
      }}
    >
      Please add your first name to your profile.{" "}
      <Link
        component={RouterLink}
        to="/settings"
        sx={{ fontWeight: 700, ml: 0.5 }}
      >
        Go to settings
      </Link>
    </Alert>
  );
}
