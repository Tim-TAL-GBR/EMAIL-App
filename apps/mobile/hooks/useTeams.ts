import { API_URL } from "@/lib/constants";
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';



export interface TeamData {
  id: string;
  name: string;
  myRole: string;
  parent_id: string | null;
}

let cachedTeams: TeamData[] | null = null;
let lastFetchAttempt = 0;

export function useTeams() {
  const [teams, setTeams] = useState<TeamData[]>(cachedTeams ?? []);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (cachedTeams !== null) {
      setTeams(cachedTeams);
      return;
    }

    // Avoid fetching more than once every 30s
    const now = Date.now();
    if (now - lastFetchAttempt < 30_000 && lastFetchAttempt > 0) return;
    lastFetchAttempt = now;

    setIsLoading(true);
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          console.warn('[useTeams] No session available, will retry');
          return;
        }
        const res = await fetch(`${API_URL}/api/teams`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const arr = Array.isArray(data) ? data : [];
        cachedTeams = arr;
        setTeams(arr);
      } catch (e) {
        console.error('Failed to fetch teams:', e);
        // Don't cache failures – allow retry on next mount
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);
  
  const safeTeams = Array.isArray(teams) ? teams : [];
  const orgs = safeTeams.filter(t => !t.parent_id);
  const getSubTeams = (orgId: string) => safeTeams.filter(t => t.parent_id === orgId);
  
  return { teams: safeTeams, orgs, getSubTeams, isLoading };
}
