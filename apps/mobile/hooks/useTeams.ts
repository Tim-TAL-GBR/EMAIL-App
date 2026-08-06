import { API_URL } from "@/lib/constants";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export interface TeamData {
  id: string;
  name: string;
  myRole: string;
  parent_id: string | null;
}

export function useTeams() {
  const cache = useRef<{ teams: TeamData[] | null; lastFetch: number }>({ teams: null, lastFetch: 0 });
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    if (cache.current.teams !== null) {
      setTeams(cache.current.teams);
      return;
    }

    const now = Date.now();
    if (now - cache.current.lastFetch < 30_000 && cache.current.lastFetch > 0) return;
    cache.current.lastFetch = now;

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
        if (mounted) {
          cache.current.teams = arr;
          setTeams(arr);
        }
      } catch (e) {
        console.error('Failed to fetch teams:', e);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    
    return () => {
      mounted = false;
    };
  }, []);
  
  const safeTeams = Array.isArray(teams) ? teams : [];
  const orgs = safeTeams.filter(t => !t.parent_id);
  const getSubTeams = (orgId: string) => safeTeams.filter(t => t.parent_id === orgId);
  
  return { teams: safeTeams, orgs, getSubTeams, isLoading };
}
