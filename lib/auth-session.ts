export type PersistedSessionAuth = {
  isAuthenticated?: boolean;
  isGuest?: boolean;
};

/**
 * Guest browsing is intentionally disabled. Any persisted guest session is
 * invalidated during app hydration and must return to the login screen.
 */
export function normalizeSessionAuth(session: PersistedSessionAuth) {
  return {
    isAuthenticated: session.isGuest !== true && session.isAuthenticated === true,
    isGuest: false as const,
  };
}
