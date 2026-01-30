import { Routes, Route } from "react-router-dom";
import { Authenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";

import Layout from "./components/Layout";
import Summary from "./pages/Summary";
import ExpenseForm from "./pages/ExpenseForm";
import Settings from "./pages/Settings";

export default function App() {
  return (
    <Authenticator hideSignUp
      components={{
        Header() {
          return <h2 style={{ textAlign: "center" }}>Trip Expense Tracker</h2>;
        },
      }}>
      {({ signOut, user }) => (
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
      )}
    </Authenticator>
  );
}
