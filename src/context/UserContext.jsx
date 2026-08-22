import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getStoredUser, setStoredUser } from '../api/client';

const UserContext = createContext(null);

export function UserProvider({ users, children }) {
  const [currentUser, setCurrentUserState] = useState(() => getStoredUser());

  useEffect(() => {
    if (currentUser && users.length && !users.includes(currentUser)) {
      setCurrentUserState(null);
      setStoredUser('');
    }
  }, [currentUser, users]);

  const setCurrentUser = (name) => {
    setCurrentUserState(name);
    if (name) setStoredUser(name);
    else localStorage.removeItem('colorado-golf-user');
  };

  const value = useMemo(
    () => ({
      users,
      currentUser,
      setCurrentUser,
      isReady: Boolean(currentUser),
    }),
    [users, currentUser]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
}
