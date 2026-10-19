"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { cta } from "./styles";

type Labels = { open: string; share: string; shareText: string; copy: string; copied: string };

const small = `${cta} min-h-10 px-4 text-sm`;

// The link has no locale prefix, so each viewer lands on the trust card in their own language.
export function TrustCardShare({ path, labels }: { path: string; labels: Labels }) {
  const [copied, setCopied] = useState(false);
  const url = () => `${location.origin}${path}`;

  return (
    <div className="flex flex-wrap gap-2.5">
      <Link href={path} className={`${small} bg-primary text-on-primary hover:bg-primary-hover`}>
        {labels.open}
      </Link>
      <button
        type="button"
        className={`${small} text-ink ring-1 ring-line ring-inset hover:ring-ink`}
        onClick={() => open(`https://wa.me/?text=${encodeURIComponent(`${labels.shareText} ${url()}`)}`, "_blank", "noopener,noreferrer")}
      >
        {labels.share}
      </button>
      <button
        type="button"
        className={`${small} text-ink ring-1 ring-line ring-inset hover:ring-ink`}
        onClick={() =>
          navigator.clipboard.writeText(url()).then(
            () => setCopied(true),
            () => {},
          )
        }
      >
        <span aria-live="polite">{copied ? labels.copied : labels.copy}</span>
      </button>
    </div>
  );
}
