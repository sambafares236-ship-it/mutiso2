import { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [roles, setRoles] = useState<string[]>([]);

  const fetchRoles = async (userId: string) => {
    try {
      const { data, error } = await supabase.from('user_roles').select('role').eq('user_id', userId);
      if (error) {
        setRoles([]);
      } else {
        setRoles(data?.map((r) => r.role) || []);
      }
    } catch {
      setRoles([]);
    }
  };

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      proactivelyCleanExpiredTokens();

      try {
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Session check timed out')), 8000),
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
      } catch {
        // Expected/handled case (e.g. stale/malformed token) - clean up and
        // continue to the login page without console noise.
        clearStaleAuthTokens();
        if (mounted) {
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
