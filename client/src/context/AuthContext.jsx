import { createContext, useContext, useEffect, useState } from "react";
import { setAuthToken } from "../api.js";

const AuthContext = createContext(null);

const STORAGE_KEY = "mockinterview.auth";

function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const stored = loadStored();
  const [token, setToken] = useState(stored?.token ?? null);
  const [user, setUser] = useState(stored?.user ?? null);

  // Keep axios and localStorage in sync with the current token.
  useEffect(() => {
    setAuthToken(token);
    if (token && user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user }));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [token, user]);

  function login({ token, user }) {
    setToken(token);
    setUser(user);
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ token, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
