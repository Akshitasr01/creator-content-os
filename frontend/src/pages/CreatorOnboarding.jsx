import { Navigate, useNavigate } from "react-router-dom";

import Logo from "../components/Logo";
import ProfileForm from "../components/ProfileForm";
import { Alert, Button, PageSpinner } from "../components/ui";
import { useProfile } from "../hooks/useProfile";
import { useToast } from "../hooks/useToast";
import { api } from "../services/api";

/** One focused onboarding form, shown once after sign-up (PDF step 7). */
export default function CreatorOnboarding() {
  const { profile, loading, error, reload, setProfile } = useProfile();
  const navigate = useNavigate();
  const toast = useToast();

  if (loading) return <PageSpinner />;
  if (profile) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(values) {
    try {
      const saved = await api.saveProfile(values);
      setProfile(saved);
      toast.success("Profile saved. Let's create your first project.");
      navigate("/projects/new", { replace: true });
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex h-16 max-w-3xl items-center px-4 sm:px-6">
        <Logo />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
        <div className="mb-8 mt-10">
          <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-muted">Step 1 of 2 · Creator profile</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Tell us how you create
          </h1>
          <p className="mt-2 text-subtle">
            This takes about two minutes. Everything here can be edited later in Settings.
          </p>
        </div>
        {error && (
          <Alert
            className="mb-6"
            title="Couldn't check for an existing profile"
            action={<Button variant="secondary" size="sm" onClick={reload}>Retry</Button>}
          >
            {error}
          </Alert>
        )}
        <ProfileForm onSubmit={handleSubmit} submitLabel="Save and continue" />
      </main>
    </div>
  );
}
