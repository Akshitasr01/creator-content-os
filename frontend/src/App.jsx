import { Navigate, Route, Routes } from "react-router-dom";

import AppShell from "./components/AppShell";
import { RedirectIfSignedIn, RequireAuth, RequireProfile } from "./components/RouteGuards";
import AuthPage from "./pages/AuthPage";
import ContentStudioPage from "./pages/ContentStudioPage";
import CreatorOnboarding from "./pages/CreatorOnboarding";
import DashboardPage from "./pages/DashboardPage";
import LandingPage from "./pages/LandingPage";
import NewProjectPage from "./pages/NewProjectPage";
import ProjectPage from "./pages/ProjectPage";
import SettingsPage from "./pages/SettingsPage";

/**
 * Public:     /  /login  /signup
 * Signed in:  /onboarding (until a profile exists)
 * App:        /dashboard  /projects/new  /projects/:id  /projects/:id/studio  /settings
 */
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<RedirectIfSignedIn><AuthPage key="login" mode="login" /></RedirectIfSignedIn>} />
      <Route path="/signup" element={<RedirectIfSignedIn><AuthPage key="signup" mode="signup" /></RedirectIfSignedIn>} />

      <Route element={<RequireAuth />}>
        <Route path="/onboarding" element={<CreatorOnboarding />} />

        <Route element={<RequireProfile />}>
          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/projects/new" element={<NewProjectPage />} />
            <Route path="/projects/:projectId" element={<ProjectPage />} />
            <Route path="/projects/:projectId/studio" element={<ContentStudioPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            {/* old URL from the previous version */}
            <Route path="/creator-voice" element={<Navigate to="/settings" replace />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
