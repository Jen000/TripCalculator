import { useState } from "react";
import { signIn } from "aws-amplify/auth";
import { Button, TextField, Card } from "@mui/material";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSignIn = async () => {
    try {
      await signIn({
        username: email,
        password,
      });
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <Card sx={{ maxWidth: 400, margin: "auto", padding: 3 }}>
      <h2>Sign In</h2>

      <TextField
        fullWidth
        label="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        margin="normal"
      />

      <TextField
        fullWidth
        label="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        margin="normal"
      />

      {error && <p style={{ color: "red" }}>{error}</p>}

      <Button fullWidth variant="contained" onClick={handleSignIn}>
        Sign In
      </Button>
    </Card>
  );
}