import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

type Theme = "dark" | "light";

const APP_VARS_KEY = "iorad-custom-app-vars";
const STORY_VARS_KEY = "iorad-custom-story-vars";

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
}

const ThemeContext = createContext<ThemeContextValue>({ theme: "dark", setTheme: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");

  // Fetch theme from DB on mount
  useEffect(() => {
    supabase
      .from("app_settings")
      .select("theme")
      .eq("id", 1)
      .single()
      .then(({ data }) => {
        const dbTheme = (data as any)?.theme as Theme | undefined;
        if (dbTheme === "light" || dbTheme === "dark") {
          setThemeState(dbTheme);
        }
      });
  }, []);

  // Apply class to <html>, then reapply any custom var overrides on top
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "light") {
      root.classList.add("light");
    } else {
      root.classList.remove("light");
    }
    // Re-stamp overrides after theme class change (theme class can override inline styles in some browsers)
    reapplySavedVars();
  }, [theme]);

  const setTheme = async (t: Theme) => {
    setThemeState(t);
    await supabase
      .from("app_settings")
      .update({ theme: t } as any)
      .eq("id", 1);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
