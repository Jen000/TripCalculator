import { Routes, Route } from "react-router-dom";
import { Authenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import { TripProvider } from "./context/TripContext";

import Layout from "./components/Layout";
import Summary from "./pages/Summary";
import ExpenseForm from "./pages/ExpenseForm";
import Settings from "./pages/Settings";
import { fetchAuthSession } from "aws-amplify/auth";


export default function App() {

  fetchAuthSession().then((s) => {
    const idToken = s.tokens?.idToken?.toString();
    if (!idToken) return;

    const payload = JSON.parse(atob(idToken.split(".")[1]));
    console.log("Cognito sub:", payload.sub);
    console.log("Token issuer:", payload.iss);
    console.log("Token audience:", payload.aud);
  });

  return (
    <Authenticator hideSignUp
      components={{
        Header() {
          return <h2 style={{ textAlign: "center" }}>Trip Expense Tracker</h2>;
        },
      }}>
      {({ signOut, user }) => (
       <TripProvider>
        <Layout
            user={user}
            onLogout={() => signOut?.()} // ✅ wraps the optional param + optional undefined
          >
            <Routes>
              <Route path="/" element={<Summary />} />
              <Route path="/expenses" element={<ExpenseForm />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </Layout>
        </TripProvider>
      )}
      
    </Authenticator>
  );
}
