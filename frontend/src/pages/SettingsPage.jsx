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
      <PageHeader title="Brand voice & settings" description="Your creator profile, writing voice and platform defaults. Every generation uses these." />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        {/* key forces a fresh form if the profile is reloaded */}
        <ProfileForm key={profile.id} profile={profile} onSubmit={handleSubmit} submitLabel="Save changes" showPlatformPreferences />

        <aside className="space-y-6 lg:sticky lg:top-20">
          <Card>
            <CardHeader title="Account" />
            <dl className="space-y-3 p-5 text-sm">
              <div>
                <dt className="text-muted">Email</dt>
                <dd className="break-all font-medium text-ink">{user?.email}</dd>
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
                    <dt className="text-muted">Mode</dt>
                    <dd className="font-medium">{usage.data.provider === "mock" ? "Demo (free)" : "Live AI"}</dd>
                  </div>
                  <div>
                    <div className="flex justify-between">
                      <dt className="text-muted">AI calls used</dt>
                      <dd className="font-medium tabular-nums">
                        {usage.data.used_today} / {usage.data.daily_limit}
                      </dd>
                    </div>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-mist" aria-hidden="true">
                      <div
                        className="h-full rounded-full bg-ink"
                        style={{ width: `${Math.min(100, (usage.data.used_today / Math.max(1, usage.data.daily_limit)) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted">The free beta limit resets daily at midnight UTC.</p>
                </dl>
              )}
            </div>
          </Card>
        </aside>
      </div>
    </>
  );
}
