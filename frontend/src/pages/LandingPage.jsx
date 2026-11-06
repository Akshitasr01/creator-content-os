import { Link } from "react-router-dom";

import Logo from "../components/Logo";
import { useAuth } from "../hooks/useAuth";

const STEPS = [
  { title: "Paste your long-form content", body: "A transcript, article, script or notes. Nothing to install." },
  { title: "Review what the AI understood", body: "A Content Brief and 10 content angles. Correct anything before generating." },
  { title: "Get platform-native content", body: "Reels, LinkedIn posts and carousels in your voice. Edit, rewrite, copy." },
];

const OUTPUTS = [
  { title: "Reel scripts", body: "Hook, 30-60s spoken script, caption, CTA and hashtags." },
  { title: "LinkedIn posts", body: "A strong first line and one clear insight, written natively for LinkedIn." },
  { title: "Carousel copy", body: "Slide-by-slide copy: hook slide, teaching slides, CTA slide." },
];

export default function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-2" aria-label="Account">
          {user ? (
            <Link to="/dashboard" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
              Open dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
                Sign in
              </Link>
              <Link to="/signup" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                Get started
              </Link>
            </>
          )}
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-4xl px-4 pb-16 pt-16 text-center sm:px-6 sm:pt-24">
          <p className="mb-4 inline-flex rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700 ring-1 ring-brand-200">
            For educators, coaches and professional creators
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-6xl">
            Turn one long-form piece of content into a week of posts, in your voice.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
            Paste a transcript or article. Creator Content OS understands it, applies your creator voice and
            writes Reels, LinkedIn posts and carousels you can edit, rewrite and copy.
          </p>
          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              to={user ? "/projects/new" : "/signup"}
              className="rounded-lg bg-brand-600 px-6 py-3 text-base font-medium text-white shadow-sm hover:bg-brand-700"
            >
              {user ? "Start a new project" : "Create your free account"}
            </Link>
            {!user && (
              <Link to="/login" className="rounded-lg px-6 py-3 text-base font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50">
                I already have an account
              </Link>
            )}
          </div>
        </section>

        <section className="border-y border-slate-200 bg-slate-50 py-16" aria-labelledby="how-heading">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 id="how-heading" className="text-center text-2xl font-semibold text-slate-900">How it works</h2>
            <ol className="mt-10 grid gap-6 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step.title} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <span className="flex size-8 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
                    {index + 1}
                  </span>
                  <h3 className="mt-4 font-semibold text-slate-900">{step.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6" aria-labelledby="outputs-heading">
          <h2 id="outputs-heading" className="text-center text-2xl font-semibold text-slate-900">What you get</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {OUTPUTS.map((output) => (
              <div key={output.title} className="rounded-xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900">{output.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{output.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-500">
        Creator Content OS · Your voice, every platform.
      </footer>
    </div>
  );
}
