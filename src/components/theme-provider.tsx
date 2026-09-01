"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type Theme = "dark" | "light";

const ThemeContext = createContext<{ theme: Theme; toggle: () => void; setTheme: (t: Theme) => void } | null>(null);

export const THEME_KEY = "campuspend-theme";

export const themeScript = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(!t){t="dark"}document.documentElement.classList.toggle("dark",t==="dark");document.documentElement.style.colorScheme=t}catch(e){document.documentElement.classList.add("dark")}})();`;

export function ThemeProvider({ children }: { children: ReactNode }) {
  // The inline theme script has already applied the stored theme to <html>
  // before hydration, so we can read it straight from the DOM.
  const [theme, setThemeState] = useState<Theme>(() =>
    typeof document === "undefined" ? "dark" : document.documentElement.classList.contains("dark") ? "dark" : "light",
  );

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem(THEME_KEY, t);
    document.documentElement.classList.toggle("dark", t === "dark");
    document.documentElement.style.colorScheme = t;
  }, []);

  const toggle = useCallback(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "light" : "dark");
  }, [setTheme]);

  return <ThemeContext.Provider value={{ theme, toggle, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
