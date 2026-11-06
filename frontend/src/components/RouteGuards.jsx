import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { useProfile } from "../hooks/useProfile";
import { Alert, Button, PageSpinner } from "./ui";

/** Signed-out users are sent to /login (and come back afterwards). */
export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageSpinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

/** Signed-in users without a creator profile go to onboarding first. */
export function RequireProfile() {
  const { profile, loading, error, reload } = useProfile();

  if (loading) return <PageSpinner label="Loading your workspace…" />;
  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20">
        <Alert
          title="We couldn't load your profile"
          action={<Button variant="secondary" size="sm" onClick={reload}>Try again</Button>}
        >
          {error}
        </Alert>
      </div>
    );
  }
  if (!profile) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}

/** /login and /signup redirect signed-in users into the app. */
export function RedirectIfSignedIn({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageSpinner />;
  if (user) return <Navigate to={location.state?.from || "/dashboard"} replace />;
  return children;
}
