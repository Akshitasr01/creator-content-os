import { ArrowRight, Link2 } from "lucide-react";
import { useId, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { pendingVideoPath, savePendingVideoUrl } from "../lib/pendingVideoUrl";

/**
 * "Paste a video link" box. Signed in: opens the YouTube or link form with the
 * URL pre-filled. Signed out: keeps the link and sends the visitor to sign up.
 */
export default function VideoUrlForm({ size = "lg", align = "center", elevated = true }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const errorId = useId();

  function handleSubmit(event) {
    event.preventDefault();
    const value = url.trim();
    if (!/^(https?:\/\/)?\S+\.\S+/i.test(value)) {
      setError("Paste a YouTube or video link, e.g. https://youtu.be/…");
      return;
    }
    savePendingVideoUrl(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    navigate(user ? pendingVideoPath(value) : "/signup");
  }

  return (
    <form onSubmit={handleSubmit} className={`w-full ${align === "center" ? "mx-auto max-w-xl" : ""}`} noValidate>
      <div
        className={`flex flex-col gap-2 rounded-xl border bg-paper p-2 ${elevated ? "shadow-lg" : "shadow-xs"} transition-colors focus-within:border-ink sm:flex-row sm:items-center ${
          error ? "border-danger" : "border-line"
        }`}
      >
        <label className="flex flex-1 items-center gap-2.5 px-2">
          <Link2 className="size-4 shrink-0 text-muted" aria-hidden="true" />
          <span className="sr-only">Video URL</span>
          <input
            type="url"
            inputMode="url"
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
              setError("");
            }}
            placeholder="Paste a YouTube or video link"
            className={`w-full bg-transparent text-ink placeholder:text-muted focus:outline-none ${size === "lg" ? "h-11 text-[15px]" : "h-10 text-sm"}`}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
          />
        </label>
        <button
          type="submit"
          className={`inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-5 font-medium text-paper transition-colors hover:bg-graphite ${size === "lg" ? "h-11 text-[15px]" : "h-10 text-sm"}`}
        >
          Generate content <ArrowRight className="size-4" aria-hidden="true" />
        </button>
      </div>
      {error ? (
        <p id={errorId} className="mt-2 text-sm text-danger" role="alert">{error}</p>
      ) : (
        <p className="mt-3 text-[13px] text-muted">
          No video link? <Link to={user ? "/create" : "/signup"} className="font-medium text-ink underline-offset-4 hover:underline">Upload a file or paste text</Link> instead.
        </p>
      )}
    </form>
  );
}
