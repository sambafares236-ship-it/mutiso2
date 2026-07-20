import { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { isNetworkFailure } from './useOfflineQueue';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isContractor: boolean;
  isForeman: boolean;
  signOut: () => Promise<void>;
  refreshRoles: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  isSuperAdmin: false,
  isAdmin: false,
  isContractor: false,
  isForeman: false,
  signOut: async () => {},
  refreshRoles: async () => {},
});

function clearStaleAuthTokens() {
  try {
    const keys = Object.keys(localStorage).filter(
      (k) => k.startsWith('sb-') && k.includes('auth-token'),
    );
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    // Storage access issues - ignore
  }
}

function proactivelyCleanExpiredTokens() {
  try {
    const keys = Object.keys(localStorage).filter(
      (k) => k.startsWith('sb-') && k.includes('auth-token'),
    );
    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          const expiresAt = parsed?.expires_at;
          if (!expiresAt || expiresAt * 1000 < Date.now()) {
            localStorage.removeItem(key);
          }
        } catch {
          localStorage.removeItem(key);
        }
      }
    }
  } catch {
    // Storage access issues - ignore, fall through to normal flow
  }
}

// Supabase's own localStorage adapter stores the full Session object
// verbatim under the sb-*-auth-token key - this reads it directly,
// bypassing getSession() entirely. Used only when getSession() couldn't be
// reached (offline/timeout), never as a substitute for the SDK's own
// resolution when it succeeds - this is a same-tab, no-network fallback,
// not a replacement for the real thing.
export function readPersistedSession(): Session | null {
  try {
    const keys = Object.keys(localStorage).filter(
      (k) => k.startsWith('sb-') && k.includes('auth-token'),
    );
    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const expiresAt = parsed?.expires_at;
      if (expiresAt && expiresAt * 1000 > Date.now() && parsed?.user) {
        return parsed as Session;
      }
    }
  } catch {
    // Malformed/inaccessible storage - fall through to null, same as "no session"
  }
  return null;
}

// A small localStorage cache of the last-known role list per user, so a
// foreman who force-quits and reopens the app while still offline sees
// their normal role-gated dashboard (stale-but-correct) instead of a
// blank/no-role state - fetchRoles() falls back to this on failure rather
// than emptying a role list that's still almost certainly right.
export function cacheRoles(userId: string, roles: string[]) {
  try {
    localStorage.setItem(`mutiso_cached_roles_${userId}`, JSON.stringify(roles));
  } catch {
    // Storage access issues - ignore, caching roles is a best-effort nicety
  }
}

export function readCachedRoles(userId: string): string[] {
  try {
    const raw = localStorage.getItem(`mutiso_cached_roles_${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [roles, setRoles] = useState<string[]>([]);

  const fetchRoles = async (userId: string) => {
    try {
      const { data, error } = await supabase.from('user_roles').select('role').eq('user_id', userId);
      if (error) {
        setRoles(readCachedRoles(userId));
      } else {
        const roleList = data?.map((r) => r.role) || [];
        setRoles(roleList);
        cacheRoles(userId, roleList);
      }
    } catch {
      setRoles(readCachedRoles(userId));
    }
  };

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      proactivelyCleanExpiredTokens();

      let timedOut = false;
      try {
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => {
            timedOut = true;
            reject(new Error('Session check timed out'));
          }, 8000),
        );

        const result = (await Promise.race([sessionPromise, timeoutPromise])) as Awaited<
          ReturnType<typeof supabase.auth.getSession>
        >;
        const session = result?.data?.session ?? null;

        if (!mounted) return;

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          await fetchRoles(session.user.id);
        }
      } catch (err) {
        if (!mounted) return;

        // getSession() either didn't resolve in time or failed with what
        // looks like a network error - both are "we couldn't reach the
        // server," not "this token is bad." Going offline is exactly the
        // condition most likely to trigger this (a stalled background
        // token-refresh attempt, or a fast-failing dead connection), so
        // treating it as a sign-out would bounce an already-logged-in
        // foreman back to the login screen for no real reason. Fall back
        // to whatever's still sitting, unexpired, in localStorage instead.
        if (timedOut || isNetworkFailure(err)) {
          const cached = readPersistedSession();
          setSession(cached);
          setUser(cached?.user ?? null);
          if (cached?.user) setRoles(readCachedRoles(cached.user.id));
        } else {
          // A genuine rejection from getSession() itself (e.g. an
          // actually invalid/revoked refresh token) - this IS a real
          // "log the user out" signal, unlike the network case above.
          clearStaleAuthTokens();
          setSession(null);
          setUser(null);
          setRoles([]);
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);

      // IMPORTANT: never await another Supabase call directly inside this
      // callback. onAuthStateChange fires while the SDK holds an internal
      // auth lock - awaiting a Supabase request in here can deadlock
      // against that lock and hang forever (no error, no timeout).
      // Deferring to the next tick releases the lock first.
      if (session?.user) {
        setTimeout(() => {
          if (mounted) {
            fetchRoles(session.user.id).finally(() => {
              if (mounted) setIsLoading(false);
            });
          }
        }, 0);
      } else {
        setRoles([]);
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    clearStaleAuthTokens();
    setRoles([]);
    setUser(null);
    setSession(null);
  };

  // Lets a caller force a fresh read of user_roles instead of waiting on
  // the next onAuthStateChange event. Needed right after consume_invite()
  // grants the foreman role - that RPC runs well after the initial
  // SIGNED_IN roles fetch, so without this the cached (empty) role list
  // would still be in effect when the app navigates to '/'.
  const refreshRoles = async () => {
    if (user) await fetchRoles(user.id);
  };

  const isSuperAdmin = roles.includes('super_admin');
  const isContractor = roles.includes('contractor');
  const isAdminRole = roles.includes('admin');
  const isForeman =
    roles.includes('foreman') &&
    !roles.includes('contractor') &&
    !roles.includes('admin') &&
    !roles.includes('super_admin');

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isSuperAdmin,
        isAdmin: isAdminRole || isSuperAdmin || isContractor,
        isContractor,
        isForeman,
        signOut,
        refreshRoles,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
