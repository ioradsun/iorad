import { createContext, useContext } from "react";

interface Signal {
  id: string;
  type: string;
  title: string;
  url: string;
  date: string | null;
  raw_excerpt: string | null;
  discovered_at: string;
}

export interface StoryDebugContextType {
  isIoradUser: boolean;
  snapshotJson: Record<string, any>;
  signals: Signal[];
  snapshotId: string | null;
}

const StoryDebugContext = createContext<StoryDebugContextType | null>(null);

export function StoryDebugProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: StoryDebugContextType | null;
}) {
  return (
    <StoryDebugContext.Provider value={value}>
      {children}
    </StoryDebugContext.Provider>
  );
}

export function useStoryDebug() {
  return useContext(StoryDebugContext);
}
