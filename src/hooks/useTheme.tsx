import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({ theme: "dark", setTheme: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [loaded, setLoaded] = useState(false);

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
        setLoaded(true);
      });
  }, []);

  // Apply class to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "light") {
      root.classList.add("light");
    } else {
      root.classList.remove("light");
    }
  }, [theme]);

  const setTheme = async (t: Theme) => {
    setThemeState(t);
    // Persist to DB
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
