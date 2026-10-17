import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Checker } from "./checker";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("checker"))("metaTitle") };
}

export default function CheckPage() {
  return <Checker />;
}
