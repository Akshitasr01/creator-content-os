import { useCallback, useEffect, useState } from "react";

/**
 * Load data once (and again on `reload()`), tracking loading + error state.
 * `load` must be stable (wrap it in useCallback or define it outside the component).
 */
export function useApiData(load) {
  const [state, setState] = useState({ data: null, error: "", loading: true });
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let active = true;
    load()
      .then((data) => active && setState({ data, error: "", loading: false }))
      .catch((error) => active && setState({ data: null, error: error.message, loading: false }));
    return () => {
      active = false;
    };
  }, [load, reloadCount]);

  const reload = useCallback(() => {
    setState((current) => ({ ...current, loading: true }));
    setReloadCount((count) => count + 1);
  }, []);

  // Lets pages apply results of their own actions without refetching.
  const setData = useCallback((updater) => {
    setState((current) => ({
      ...current,
      data: typeof updater === "function" ? updater(current.data) : updater,
    }));
  }, []);

  return { ...state, reload, setData };
}
