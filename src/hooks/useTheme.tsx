import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "dark" | "light";

const APP_VARS_KEY = "iorad-custom-app-vars";
const STORY_VARS_KEY = "iorad-custom-story-vars";
const THEME_CACHE_KEY = "iorad-theme-cache";

/** Apply a record of CSS custom properties to the document root */
export function applyCustomVars(vars: Record<string, string>) {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(vars)) {
    root.style.setProperty(k, v);
  }
}

/** Remove previously applied custom vars from the document root */
export function clearCustomVars(vars: Record<string, string>) {
  const root = document.documentElement;
  for (const k of Object.keys(vars)) {
    root.style.removeProperty(k);
  }
}

/** Load and reapply saved overrides from localStorage */
function reapplySavedVars() {
  try {
    const appRaw = localStorage.getItem(APP_VARS_KEY);
    if (appRaw) applyCustomVars(JSON.parse(appRaw));
    const storyRaw = localStorage.getItem(STORY_VARS_KEY);
    if (storyRaw) applyCustomVars(JSON.parse(storyRaw));
  } catch {}
}

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  setTheme: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const cached = localStorage.getItem(THEME_CACHE_KEY);
      if (cached === "light" || cached === "dark") return cached;
      const stored = localStorage.getItem("theme");
      if (stored === "light" || stored === "dark") return stored;
    } catch {}
    return "dark";
  });

  useEffect(() => {
    // Apply stored theme on mount — no ref needed
    const stored = localStorage.getItem("theme") as "dark" | "light" | null;
    const initialTheme = stored || theme || "dark";
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(initialTheme);
    reapplySavedVars();
    if (initialTheme !== theme) {
      setThemeState(initialTheme);
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(theme);
    try {
      localStorage.setItem("theme", theme);
      localStorage.setItem(THEME_CACHE_KEY, theme);
    } catch {}
    reapplySavedVars();
  }, [theme]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
  };

  const toggleTheme = () => {
    setThemeState((current) => (current === "dark" ? "light" : "dark"));
  };

  return <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
