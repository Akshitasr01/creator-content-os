import { useCallback } from "react";

import ProfileForm from "../components/ProfileForm";
import { Alert, Card, CardHeader, PageHeader } from "../components/ui";
import { useApiData } from "../hooks/useApiData";
import { useAuth } from "../hooks/useAuth";
import { useProfile } from "../hooks/useProfile";
import { useToast } from "../hooks/useToast";
import { api } from "../services/api";

export default function SettingsPage() {
  const { profile, setProfile } = useProfile();
  const { user } = useAuth();
  const toast = useToast();
  const usage = useApiData(useCallback(() => api.getUsage(), []));

  async function handleSubmit(values) {
    try {
      const saved = await api.saveProfile(values);
      setProfile(saved);
      toast.success("Settings saved. New content will use your updated voice.");
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <>
      <PageHeader title="Settings" description="Your creator profile, voice and platform defaults." />

      <div className="grid gap-8 lg:grid-cols-[1fr_18rem]">
        {/* key forces a fresh form if the profile is reloaded */}
        <ProfileForm key={profile.id} profile={profile} onSubmit={handleSubmit} submitLabel="Save changes" showPlatformPreferences />

        <aside className="space-y-6">
          <Card>
            <CardHeader title="Account" />
            <dl className="space-y-3 p-5 text-sm">
              <div>
                <dt className="text-slate-500">Email</dt>
                <dd className="break-all font-medium text-slate-900">{user?.email}</dd>
              </div>
            </dl>
          </Card>

          <Card>
            <CardHeader title="AI usage today" />
            <div className="p-5 text-sm">
              {usage.error && <Alert>{usage.error}</Alert>}
              {usage.data && (
                <dl className="space-y-3">
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Mode</dt>
                    <dd className="font-medium">{usage.data.provider === "mock" ? "Demo (free)" : "Live AI"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">AI calls used</dt>
                    <dd className="font-medium">
                      {usage.data.used_today} / {usage.data.daily_limit}
                    </dd>
                  </div>
                  <p className="text-xs text-slate-500">The free beta limit resets daily at midnight UTC.</p>
                </dl>
              )}
            </div>
          </Card>
        </aside>
      </div>
    </>
  );
}
