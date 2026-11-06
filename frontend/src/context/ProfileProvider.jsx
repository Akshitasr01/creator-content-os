import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "../hooks/useAuth";
import { api } from "../services/api";
import { ProfileContext } from "./contexts";

/**
 * Loads the signed-in user's creator profile from the backend.
 * profile === null after loading means "not onboarded yet".
 */
export default function ProfileProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  // Results are keyed by user id so switching accounts never shows stale data.
  const [state, setState] = useState({ userId: null, profile: null, error: "" });
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let active = true;

    api
      .getProfile()
      .then((profile) => active && setState({ userId, profile, error: "" }))
      .catch((error) => active && setState({ userId, profile: null, error: error.message }));

    return () => {
      active = false;
    };
  }, [userId, reloadCount]);

  const reload = useCallback(() => {
    setState((current) => ({ ...current, userId: null }));
    setReloadCount((count) => count + 1);
  }, []);

  const setProfile = useCallback(
    (profile) => setState({ userId, profile, error: "" }),
    [userId]
  );

  const value = useMemo(() => {
    const ready = state.userId === userId;
    return {
      profile: ready ? state.profile : null,
      error: ready ? state.error : "",
      loading: Boolean(userId) && !ready,
      reload,
      setProfile,
    };
  }, [state, userId, reload, setProfile]);

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}
