import React, { useState } from "react";
import CardWrapper from "../components/CardWrapper";
import { TextField, Button, Divider, Typography } from "@mui/material";

const Settings: React.FC = () => {
  // Password state
  const [current, setCurrent] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirm, setConfirm] = useState("");

  // Google Sheet state
  const [sheetUrl, setSheetUrl] = useState("");

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass !== confirm) {
      alert("Passwords do not match!");
      return;
    }
    alert("Password changed! (dummy)");
    setCurrent(""); setNewPass(""); setConfirm("");
  };

  const handleSheetUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sheetUrl) {
      alert("Please enter a Google Sheet URL");
      return;
    }
    alert(`Google Sheet URL updated to:\n${sheetUrl} (dummy)`);
    setSheetUrl("");
  };

  return (
    <CardWrapper title="Settings">
       <Divider sx={{ mb: 2 }} />

      {/* --- Update Google Sheet URL --- */}
      <Typography variant="subtitle1" gutterBottom>
        Update Google Sheet URL
      </Typography>
      <form
        style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}
        onSubmit={handleSheetUpdate}
      >
        <TextField
          placeholder="Google Sheet URL"
          fullWidth
          value={sheetUrl}
          onChange={(e) => setSheetUrl(e.target.value)}
        />
        <Button variant="contained" color="primary" type="submit">
          Update Sheet
        </Button>
      </form>

      <Divider sx={{ mb: 2 }} />
      

      {/* --- Update Password --- */}
      <Typography variant="subtitle1" gutterBottom>
        Update Password
      </Typography>
      <form
        style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}
        onSubmit={handlePasswordChange}
      >
        <TextField
          type="password"
          placeholder="Current Password"
          fullWidth
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
        <TextField
          type="password"
          placeholder="New Password"
          fullWidth
          value={newPass}
          onChange={(e) => setNewPass(e.target.value)}
        />
        <TextField
          type="password"
          placeholder="Confirm New Password"
          fullWidth
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <Button variant="contained" color="secondary" type="submit">
          Change Password
        </Button>
      </form>
    </CardWrapper>
  );
};

export default Settings;