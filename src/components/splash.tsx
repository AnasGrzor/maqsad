"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { SPLASH_KEY } from "./brand";

const WORD = "مقصد";

// The Urdu calligraphy logo writes itself right to left. The head script sets data-splash on <html> only on the
// first page load of a browser session, so the overlay is in the server HTML and never pops in after content.
export function Splash() {
  const t = useTranslations("splash");
  const root = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const html = document.documentElement;
    if (!("splash" in html.dataset)) return;
    const el = root.current!;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let done = false;
    const end = () => {
      if (done) return;
      done = true;
      el.classList.add("out");
      try {
        sessionStorage.setItem(SPLASH_KEY, "1");
      } catch {}
      timers.push(setTimeout(() => delete html.dataset.splash, reduce ? 300 : 520));
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        end();
      }
    };
    addEventListener("keydown", onKey);
    el.addEventListener("click", end);
    // Wait for the Nastaliq face so the stroke never reveals a fallback font, then fit the viewBox to the ink.
    const face = `700 200px ${getComputedStyle(el).getPropertyValue("--font-nastaliq")}`;
    const font = document.fonts.load(face, WORD).catch(() => {});
    Promise.race([font, new Promise((r) => setTimeout(r, 1500))]).then(() => {
      if (done) return;
      const ctx = document.createElement("canvas").getContext("2d")!;
      ctx.font = face;
      ctx.direction = "rtl";
      ctx.textAlign = "center";
      const m = ctx.measureText(WORD);
      const pad = 6;
      const w = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
      if (w) {
        const box = [-m.actualBoundingBoxLeft - pad, -m.actualBoundingBoxAscent - pad, w + pad * 2, m.actualBoundingBoxAscent + m.actualBoundingBoxDescent + pad * 2];
        svg.current!.setAttribute("viewBox", box.join(" "));
      }
      el.classList.add("play");
      timers.push(setTimeout(end, reduce ? 1300 : 2900));
    });
    return () => {
      removeEventListener("keydown", onKey);
      el.removeEventListener("click", end);
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <div ref={root} className="splash" role="presentation">
      <svg aria-hidden className="absolute inset-x-0 top-0 h-3 w-full">
        <rect width="100%" height="100%" fill="url(#tile)" />
      </svg>
      <svg aria-hidden className="absolute inset-x-0 bottom-0 h-3 w-full">
        <rect width="100%" height="100%" fill="url(#tile)" />
      </svg>
      <div lang="ur" className="relative grid justify-items-center gap-3.5 pt-10">
        <svg ref={svg} aria-hidden className="ur-svg" viewBox="-240 -260 480 380">
          <text textAnchor="middle" direction="rtl" fill="url(#tileInk)" stroke="var(--logo-line)" strokeWidth={2} strokeLinejoin="round">
            {WORD}
          </text>
        </svg>
        <div aria-hidden className="kashida">
          <svg viewBox="0 0 100 100">
            <use href="#mark" />
          </svg>
        </div>
        <p lang="en" className="cap mt-3 font-mono text-[12.5px] tracking-[0.34em] text-soft uppercase">
          {t("caption")}
        </p>
      </div>
      <button
        type="button"
        className="absolute end-[18px] bottom-7 cursor-pointer rounded-full border border-line bg-card px-3.5 py-1.5 text-[13px] font-medium text-ink"
      >
        {t("skip")}
      </button>
    </div>
  );
}
