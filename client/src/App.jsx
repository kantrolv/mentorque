import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import NewInterview from "./pages/NewInterview.jsx";
import Interview from "./pages/Interview.jsx";
import ReportPage from "./pages/ReportPage.jsx";

function RequireAuth({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const { token } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={token ? <Navigate to="/" replace /> : <AuthPage />}
      />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Dashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/new"
        element={
          <RequireAuth>
            <NewInterview />
          </RequireAuth>
        }
      />
      <Route
        path="/interview/:id"
        element={
          <RequireAuth>
            <Interview />
          </RequireAuth>
        }
      />
      <Route
        path="/report/:id"
        element={
          <RequireAuth>
            <ReportPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
