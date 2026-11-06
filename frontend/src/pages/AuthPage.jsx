import { useState } from "react";
import { Link } from "react-router-dom";

import Logo from "../components/Logo";
import { Alert, Button, Card, TextInput } from "../components/ui";
import { loginUser, resendConfirmation, signUpUser } from "../services/auth";

function friendlyAuthError(error) {
  const message = error?.message || "Something went wrong. Please try again.";
  if (/email not confirmed/i.test(message)) return "Please confirm your email first. Check your inbox for the confirmation link.";
  if (/invalid login credentials/i.test(message)) return "That email and password don't match. Check them and try again.";
  if (/already registered/i.test(message)) return "An account with this email already exists. Sign in instead.";
  if (/failed to fetch/i.test(message)) return "Can't reach the authentication service. Check your internet connection.";
  return message;
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-12">
      <div className="mb-8">
        <Logo />
      </div>

      <Card className="w-full max-w-md p-6 sm:p-8">
        {confirmationSentTo ? (
          <div className="text-center" role="status">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-brand-50 text-xl" aria-hidden="true">
              ✉
            </div>
            <h1 className="text-xl font-semibold text-slate-900">Check your inbox</h1>
            <p className="mt-2 text-sm text-slate-600">
              We sent a confirmation link to <strong>{confirmationSentTo}</strong>. Click it, then come back and sign in.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Link to="/login" onClick={() => setConfirmationSentTo("")} className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700">
                Go to sign in
              </Link>
              <Button variant="ghost" onClick={handleResend} loading={resending}>
                Resend email
              </Button>
            </div>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-semibold text-slate-900">
              {isSignup ? "Create your account" : "Welcome back"}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {isSignup ? "Start turning long-form content into posts." : "Sign in to your content workspace."}
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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

              <Button type="submit" className="w-full" loading={loading}>
                {isSignup ? "Create account" : "Sign in"}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-600">
              {isSignup ? "Already have an account? " : "New here? "}
              <Link
                to={isSignup ? "/login" : "/signup"}
                className="font-medium text-brand-600 hover:text-brand-700"
                onClick={() => setError("")}
              >
                {isSignup ? "Sign in" : "Create an account"}
              </Link>
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
