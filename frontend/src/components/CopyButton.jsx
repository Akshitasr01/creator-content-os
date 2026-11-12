import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { useToast } from "../hooks/useToast";
import { Button } from "./ui";

export default function CopyButton({ text, label = "Copy", size = "sm", variant = "secondary" }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Couldn't copy automatically. Select the text and copy it manually.");
    }
  }

  return (
    <Button variant={variant} size={size} onClick={handleCopy} aria-live="polite">
      {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
      {copied ? "Copied" : label}
    </Button>
  );
}
