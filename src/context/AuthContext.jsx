import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  changePassword as changePasswordApi,
  clearAuthSession,
  fetchMe,
  getStoredToken,
  getStoredUser,
  loginAccount,
  logoutAccount,
  setAuthSession,
  setupFirstAdmin,
} from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser());
  const [users, setUsers] = useState([]);
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState(null);

  const applySession = useCallback((data) => {
    setAuthSession(data.token, data.user);
    setUser(data.user);
    setError(null);
  }, []);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setBooting(false);
      return;
    }
    fetchMe()
      .then((me) => {
        if (me.status && me.status !== 'approved') {
          clearAuthSession();
          setUser(null);
          return;
        }
        setUser(me);
        setAuthSession(token, me);
      })
      .catch(() => {
        clearAuthSession();
        setUser(null);
      })
      .finally(() => setBooting(false));
  }, []);

  const login = useCallback(
    async (email, password) => {
      const data = await loginAccount(email, password);
      applySession(data);
      return data.user;
    },
    [applySession]
  );

  const completeSetup = useCallback(
    async (payload) => {
      const data = await setupFirstAdmin(payload);
      applySession(data);
      return data.user;
    },
    [applySession]
  );

  const logout = useCallback(async () => {
    await logoutAccount();
    setUser(null);
    setUsers([]);
  }, []);

  const changePassword = useCallback(
    async (currentPassword, newPassword) => {
      const data = await changePasswordApi(currentPassword, newPassword);
      setAuthSession(getStoredToken(), data.user);
      setUser(data.user);
      setError(null);
      return data.user;
    },
    []
  );

  const mustChangePassword = Boolean(user?.mustChangePassword);
  const isAuthenticated = Boolean(user && user.status === 'approved');
  const canUseApp = isAuthenticated && !mustChangePassword;

  const value = useMemo(
    () => ({
      user,
      users,
      setUsers,
      login,
      completeSetup,
      logout,
      changePassword,
      isAuthenticated,
      mustChangePassword,
      canUseApp,
      isAdmin: Boolean(user?.isAdmin),
      booting,
      error,
      setError,
    }),
    [
      user,
      users,
      login,
      completeSetup,
      logout,
      changePassword,
      isAuthenticated,
      mustChangePassword,
      canUseApp,
      booting,
      error,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
