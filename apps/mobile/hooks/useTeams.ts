import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const API_URL = process.env.EXPO_PUBLIC_SERVER_URL || 'http://localhost:3001';

export interface TeamData {
  id: string;
  name: string;
  myRole: string;
  parent_id: string | null;
}

let cachedTeams: TeamData[] | null = null;
let fetchPromise: Promise<TeamData[]> | null = null;

export function useTeams() {
  const [teams, setTeams] = useState<TeamData[]>(cachedTeams ?? []);
  const [isLoading, setIsLoading] = useState(!cachedTeams);

  useEffect(() => {
    if (cachedTeams) {
      setTeams(cachedTeams);
      setIsLoading(false);
      return;
    }

    if (!fetchPromise) {
      fetchPromise = (async (): Promise<TeamData[]> => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const res = await fetch(`${API_URL}/api/teams`, {
            headers: { 'Authorization': `Bearer ${session?.access_token}` },
          });
          const data = await res.json();
          cachedTeams = data || [];
          return cachedTeams!;
        } catch (e) {
          console.error('Failed to fetch teams:', e);
          cachedTeams = [];
          return cachedTeams;
        } finally {
          fetchPromise = null;
        }
      })();
    }

    fetchPromise.then(data => {
      setTeams(data ?? []);
      setIsLoading(false);
    });
  }, []);

  const orgs = teams.filter(t => !t.parent_id);
  const getSubTeams = (orgId: string) => teams.filter(t => t.parent_id === orgId);

  return { teams, orgs, getSubTeams, isLoading };
}
