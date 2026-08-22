import { useCallback, useState } from 'react';

export function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item == null) return initialValue;
      return JSON.parse(item);
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback(
    (valueOrUpdater) => {
      setStoredValue((prev) => {
        const next =
          typeof valueOrUpdater === 'function'
            ? valueOrUpdater(prev)
            : valueOrUpdater;
        try {
          window.localStorage.setItem(key, JSON.stringify(next));
        } catch (e) {
          console.warn('useLocalStorage: could not persist', e);
        }
        return next;
      });
    },
    [key]
  );

  return [storedValue, setValue];
}
