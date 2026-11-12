import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";

import { FEEDBACK_REASONS } from "../../lib/constants";
import { Button, Modal, TextArea } from "../ui";

/** Thumbs up / down; thumbs down asks one quick reason (PDF step 25). */
export default function FeedbackControls({ status, onFeedback, disabled }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("not_my_voice");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  async function send(feedback) {
    setSending(true);
    const ok = await onFeedback(feedback);
    setSending(false);
    if (ok) {
      setOpen(false);
      setNote("");
    }
  }

  return (
    <>
      <div className="flex items-center gap-1" role="group" aria-label="Rate this asset">
        <Button
          variant={status === "liked" ? "primary" : "ghost"}
          size="sm"
          aria-pressed={status === "liked"}
          aria-label="Thumbs up"
          title="Good output"
          disabled={disabled || sending}
          className="w-8 px-0"
          onClick={() => send({ rating: "up" })}
        >
          <ThumbsUp className="size-4" aria-hidden="true" />
        </Button>
        <Button
          variant={status === "disliked" ? "primary" : "ghost"}
          size="sm"
          aria-pressed={status === "disliked"}
          aria-label="Thumbs down"
          title="Needs work"
          disabled={disabled || sending}
          className="w-8 px-0"
          onClick={() => setOpen(true)}
        >
          <ThumbsDown className="size-4" aria-hidden="true" />
        </Button>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="What's wrong with it?">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            send({ rating: "down", reason, note: note.trim() || null });
          }}
          className="space-y-4"
        >
          <fieldset className="grid grid-cols-2 gap-2">
            <legend className="sr-only">Reason</legend>
            {FEEDBACK_REASONS.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm transition-colors hover:bg-mist has-checked:border-ink has-checked:bg-mist"
              >
                <input
                  type="radio"
                  name="feedback-reason"
                  className="accent-ink"
                  value={option.value}
                  checked={reason === option.value}
                  onChange={() => setReason(option.value)}
                />
                {option.label}
              </label>
            ))}
          </fieldset>
          <TextArea label="Note (optional)" rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={sending}>
              Send feedback
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
