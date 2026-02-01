import { createTheme, alpha } from "@mui/material/styles";

export function makeTheme(mode: "light" | "dark") {
  const light = {
    primary: "#1F7A63",
    secondary: "#A8D5BA",
    bg: "#EEF7F2",        // noticeably greener background
    paper: "#FFFFFF",
    text: "#2B2B2B",
    textSecondary: "#3E4A45",
    appBar: "#1F7A63",    // strong brand
  };

  const dark = {
    primary: "#2AAE8C",
    secondary: "#7FBF9B",
    bg: "#08110E",        // deep green-black
    paper: "#0F1A16",
    text: "#E9F2EE",
    textSecondary: "#B7C9C1",
    appBar: "#0F1A16",    // darker “surface” bar in dark mode
  };

  const c = mode === "light" ? light : dark;

  return createTheme({
    palette: {
      mode,
      primary: { main: c.primary },
      secondary: { main: c.secondary },
      background: { default: c.bg, paper: c.paper },
      text: { primary: c.text, secondary: c.textSecondary },
      divider: alpha(c.primary, mode === "light" ? 0.18 : 0.22),
    },
    typography: {
      fontFamily: ["ui-sans-serif", "system-ui", "Segoe UI", "Roboto", "Arial"].join(","),
      h5: { fontWeight: 900 },
      h6: { fontWeight: 800 },
    },
    components: {
      // ✅ polished green header (light), calm dark surface (dark)
      MuiAppBar: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            borderRadius: 0,
            color: mode === "light" ? "#FFFFFF" : c.text,
            background:
              mode === "light"
                ? `linear-gradient(180deg, ${c.primary} 0%, ${alpha(c.primary, 0.92)} 100%)`
                : c.appBar,
            borderBottom:
              mode === "light"
                ? `1px solid ${alpha("#fff", 0.18)}`
                : `1px solid ${alpha(c.text, 0.10)}`,
            boxShadow:
              mode === "light"
                ? "0 10px 24px rgba(31,122,99,0.22)"
                : "0 10px 30px rgba(0,0,0,0.55)",
          },
        },
      },

      // cards: crisp, subtle green outline in light mode
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            border:
              mode === "light"
                ? `1px solid ${alpha(c.primary, 0.12)}`
                : `1px solid ${alpha("#E9F2EE", 0.08)}`,
            boxShadow:
              mode === "light"
                ? "0 10px 28px rgba(0,0,0,0.07)"
                : "0 10px 30px rgba(0,0,0,0.55)",
          },
        },
      },

      // inputs: green focus ring
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            backgroundColor: mode === "light" ? alpha(c.secondary, 0.15) : alpha(c.paper, 0.35),
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: alpha(c.primary, 0.35),
            },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderColor: c.primary,
              borderWidth: 2,
            },
          },
          notchedOutline: {
            borderColor: alpha(c.primary, mode === "light" ? 0.18 : 0.22),
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: { root: { "&.Mui-focused": { color: c.primary } } },
      },

      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { borderRadius: 12, textTransform: "none", fontWeight: 700 },
        },
      },
        MuiSelect: {
            styleOverrides: {
            icon: {
                color: c.textSecondary,
                },
            },
        },
    },
  });
}