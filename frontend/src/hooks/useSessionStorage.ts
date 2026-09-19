import { Dispatch, SetStateAction, useEffect, useState } from "react";

export function useSessionStorage<T>(
  key: string,
  initialValue: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState(initialValue);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedValue = window.sessionStorage.getItem(key);
      if (storedValue !== null) {
        try {
          setValue(JSON.parse(storedValue) as T);
        } catch {
          window.sessionStorage.removeItem(key);
        }
      }
    }

    setHasHydrated(true);
  }, [key]);

  useEffect(() => {
    if (!hasHydrated || typeof window === "undefined") return;

    window.sessionStorage.setItem(key, JSON.stringify(value));
  }, [hasHydrated, key, value]);

  return [value, setValue];
}