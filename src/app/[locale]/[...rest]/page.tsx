import { notFound } from "next/navigation";

// Sends unknown paths under a locale to [locale]/not-found.tsx, inside the localized root layout.
export default function CatchAll() {
  notFound();
}
