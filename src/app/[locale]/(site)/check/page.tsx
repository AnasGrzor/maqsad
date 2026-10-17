import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Checker } from "./checker";
import { SaveOption } from "./save-option";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("checker"))("metaTitle") };
}

// The page stays static; only the save checkbox depends on who is signed in.
export default function CheckPage() {
  return (
    <Checker
      saveOption={
        <Suspense fallback={null}>
          <SaveOption />
        </Suspense>
      }
    />
  );
}
