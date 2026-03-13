import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "recent_contacts";
const MAX_RECENT = 10;

interface RecentContact {
  id: string;
  visitedAt: number;
}

export function useRecentContacts(companyId: string | null) {
  const [recents, setRecents] = useState<RecentContact[]>([]);

  // Load from localStorage on mount / companyId change
  useEffect(() => {
    if (!companyId) return;
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY}:${companyId}`);
      setRecents(raw ? JSON.parse(raw) : []);
    } catch {
      setRecents([]);
    }
  }, [companyId]);

  const trackContact = useCallback(
    (contactId: string) => {
      if (!companyId) return;
      setRecents((prev) => {
        const filtered = prev.filter((r) => r.id !== contactId);
        const next = [{ id: contactId, visitedAt: Date.now() }, ...filtered].slice(0, MAX_RECENT);
        localStorage.setItem(`${STORAGE_KEY}:${companyId}`, JSON.stringify(next));
        return next;
      });
    },
    [companyId]
  );

  const isRecent = useCallback(
    (contactId: string) => recents.some((r) => r.id === contactId),
    [recents]
  );

  return { recentContactIds: recents.map((r) => r.id), trackContact, isRecent };
}
