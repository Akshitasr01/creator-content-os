import { Check, MailCheck } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import Logo from "../components/Logo";
import { Alert, Button, IconTile, TextInput } from "../components/ui";
import { peekPendingVideoUrl } from "../lib/pendingVideoUrl";
import { loginUser, resendConfirmation, signUpUser } from "../services/auth";

function friendlyAuthError(error) {
  const message = error?.message || "Something went wrong. Please try again.";
  if (/email not confirmed/i.test(message)) return "Please confirm your email first. Check your inbox for the confirmation link.";
  if (/invalid login credentials/i.test(message)) return "That email and password don't match. Check them and try again.";
  if (/already registered/i.test(message)) return "An account with this email already exists. Sign in instead.";
  if (/failed to fetch/i.test(message)) return "Can't reach the authentication service. Check your internet connection.";
  return message;
}

const PERKS = [
  "Clips, Reels, LinkedIn posts and carousels from one source",
  "Written in your own creator voice",
  "Edit, rewrite and keep every version",
];

/** Black brand panel shown beside the form on large screens. */
function BrandPanel() {
  return (
    <aside className="relative hidden flex-col justify-between bg-ink p-12 text-paper lg:flex">
      <Logo inverted />
      <div>
        <p className="text-4xl font-semibold leading-tight tracking-tight">
          One video.
          <br />
          <span className="text-paper/50">A week of content.</span>
        </p>
        <ul className="mt-10 space-y-4 text-sm text-paper/80">
          {PERKS.map((perk) => (
            <li key={perk} className="flex items-start gap-3">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-paper/25">
                <Check className="size-3" aria-hidden="true" />
              </span>
              {perk}
            </li>
          ))}
        </ul>
      </div>
      <p className="text-xs text-paper/50">Private by default. Your content is visible only to you.</p>
    </aside>
  );
}

/** Sign in / sign up. `mode` comes from the route (/login or /signup). */
export default function AuthPage({ mode }) {
  const isSignup = mode === "signup";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [confirmationSentTo, setConfirmationSentTo] = useState("");
  const [resending, setResending] = useState(false);
  const [hasPendingLink] = useState(() => Boolean(peekPendingVideoUrl()));

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNeedsConfirmation(false);
    try {
      if (isSignup) {
        const data = await signUpUser(email, password);
        // With email confirmation enabled Supabase returns no session yet.
        if (!data.session) setConfirmationSentTo(email);
        // With a session, AuthProvider updates and the route redirects.
      } else {
        await loginUser(email, password);
      }
    } catch (err) {
      setError(friendlyAuthError(err));
      setNeedsConfirmation(/email not confirmed/i.test(err?.message || ""));
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    try {
      await resendConfirmation(email);
      setConfirmationSentTo(email);
      setError("");
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-paper lg:grid-cols-2">
      <BrandPanel />
      <main className="flex flex-col items-center justify-center px-4 py-12 sm:px-8">
      <div className="mb-10 lg:hidden">
        <Logo />
      </div>

      <div className="w-full max-w-sm">
        {confirmationSentTo ? (
          <div className="text-center" role="status">
            <IconTile icon={MailCheck} inverted className="mx-auto mb-5 size-12!" />
            <h1 className="text-2xl font-semibold tracking-tight text-ink">Check your inbox</h1>
            <p className="mt-2 text-sm text-subtle">
              We sent a confirmation link to <strong>{confirmationSentTo}</strong>. Click it, then come back and sign in.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Link to="/login" onClick={() => setConfirmationSentTo("")} className="flex h-10 items-center justify-center rounded-lg bg-ink px-4 text-sm font-medium text-paper transition-colors hover:bg-graphite">
                Go to sign in
              </Link>
              <Button variant="ghost" onClick={handleResend} loading={resending}>
                Resend email
              </Button>
            </div>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">
              {isSignup ? "Create your account" : "Welcome back"}
            </h1>
            <p className="mt-1.5 text-sm text-muted">
              {isSignup ? "Start turning long-form content into posts." : "Sign in to your content workspace."}
            </p>
            {hasPendingLink && (
              <p className="mt-4 rounded-lg border border-line bg-canvas px-3 py-2 text-[13px] text-subtle">
                Your video link is saved. You can continue with it after signing in.
              </p>
            )}

            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <TextInput
                label="Email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <TextInput
                label="Password"
                type="password"
                autoComplete={isSignup ? "new-password" : "current-password"}
                required
                minLength={6}
                hint={isSignup ? "At least 6 characters." : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              {error && (
                <Alert
                  action={
                    needsConfirmation && (
                      <Button variant="secondary" size="sm" onClick={handleResend} loading={resending}>
                        Resend link
                      </Button>
                    )
                  }
                >
                  {error}
                </Alert>
              )}

              <Button type="submit" size="lg" className="mt-2 w-full" loading={loading}>
                {isSignup ? "Create account" : "Sign in"}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-subtle">
              {isSignup ? "Already have an account? " : "New here? "}
              <Link
                to={isSignup ? "/login" : "/signup"}
                className="font-medium text-ink underline-offset-4 hover:underline"
                onClick={() => setError("")}
              >
                {isSignup ? "Sign in" : "Create an account"}
              </Link>
            </p>
          </>
        )}
      </div>
      </main>
    </div>
  );
}
