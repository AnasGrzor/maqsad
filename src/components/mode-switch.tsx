"use client";

import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { MODE_KEY as KEY } from "./brand";
import { focusRing } from "./styles";

const subscribe = (cb: () => void) => {
  const o = new MutationObserver(cb);
  o.observe(document.documentElement, { attributes: true, attributeFilter: ["data-mode"] });
  return () => o.disconnect();
};
const isDark = () => document.documentElement.dataset.mode === "dark";

export function ModeSwitch() {
  const t = useTranslations("nav");
  const dark = useSyncExternalStore(subscribe, isDark, () => false);
  function toggle() {
    const next = !isDark();
    if (next) document.documentElement.dataset.mode = "dark";
    else delete document.documentElement.dataset.mode;
    try {
      localStorage.setItem(KEY, next ? "dark" : "light");
    } catch {}
  }
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={dark}
      aria-label={t("darkTheme")}
      className={`inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full border border-line bg-card px-3 text-[13.5px] font-semibold text-ink hover:border-ink ${focusRing}`}
    >
      <i aria-hidden className="size-4 rounded-full border-2 border-current bg-[linear-gradient(90deg,currentColor_50%,transparent_50%)]" />
      <span className="hidden 2xl:inline">{dark ? t("light") : t("dark")}</span>
    </button>
  );
}
