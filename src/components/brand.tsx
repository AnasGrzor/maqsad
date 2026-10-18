import { Link } from "@/i18n/navigation";
import { focusRing } from "./styles";

export const MODE_KEY = "maqsad-mode";
export const SPLASH_KEY = "maqsad-splash";

// Runs in <head> before paint so a saved dark choice never flashes light. Also starts the splash once per session.
export const themeScript = `try{if(localStorage.getItem("${MODE_KEY}")==="dark")document.documentElement.dataset.mode="dark"}catch(e){}try{if(!sessionStorage.getItem("${SPLASH_KEY}"))document.documentElement.dataset.splash=""}catch(e){}`;

// The eight-point star and the Wazir Khan tile, defined once in the root layout and referenced with <use>.
export function BrandDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden focusable="false">
      <defs>
        <symbol id="mark" viewBox="0 0 100 100">
          <rect x="17" y="17" width="66" height="66" rx="7" fill="currentColor" />
          <rect x="17" y="17" width="66" height="66" rx="7" fill="currentColor" transform="rotate(45 50 50)" />
          <circle cx="50" cy="50" r="21" style={{ fill: "var(--turq)" }} />
          <rect x="43" y="43" width="14" height="14" style={{ fill: "var(--terra)" }} transform="rotate(45 50 50)" />
        </symbol>
        <pattern id="tile" width="48" height="48" patternUnits="userSpaceOnUse">
          <rect width="48" height="48" style={{ fill: "var(--lapis)" }} />
          <rect x="13" y="13" width="22" height="22" style={{ fill: "var(--turq)" }} />
          <rect x="13" y="13" width="22" height="22" style={{ fill: "var(--turq)" }} transform="rotate(45 24 24)" />
          <rect x="18" y="18" width="12" height="12" style={{ fill: "var(--marble)" }} transform="rotate(45 24 24)" />
          <circle cx="24" cy="24" r="3" style={{ fill: "var(--terra)" }} />
          <path d="M0 6 L6 0 M42 0 L48 6 M48 42 L42 48 M6 48 L0 42" style={{ stroke: "var(--marble)" }} strokeWidth="2" />
          {[0, 48].flatMap((x) => [0, 48].map((y) => <circle key={`${x}${y}`} cx={x} cy={y} r="4" style={{ fill: "var(--terra)" }} />))}
        </pattern>
        {/* Finer tile that fills the Urdu calligraphy: 24 units against a 200-unit font size. */}
        <pattern id="tileInk" width="24" height="24" patternUnits="userSpaceOnUse">
          <rect width="24" height="24" style={{ fill: "var(--lapis)" }} />
          <rect x="6.5" y="6.5" width="11" height="11" style={{ fill: "var(--turq)" }} />
          <rect x="6.5" y="6.5" width="11" height="11" style={{ fill: "var(--turq)" }} transform="rotate(45 12 12)" />
          <rect x="9.5" y="9.5" width="5" height="5" style={{ fill: "var(--marble)" }} transform="rotate(45 12 12)" />
          {[0, 24].flatMap((x) => [0, 24].map((y) => <circle key={`${x}${y}`} cx={x} cy={y} r="2.4" style={{ fill: "var(--terra)" }} />))}
        </pattern>
      </defs>
    </svg>
  );
}

export function Mark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden className={`shrink-0 ${className}`}>
      <use href="#mark" />
    </svg>
  );
}

export function TileBand({ className = "h-[26px]" }: { className?: string }) {
  return (
    <svg aria-hidden className={`block w-full ${className}`}>
      <rect width="100%" height="100%" fill="url(#tile)" />
    </svg>
  );
}

export function Wordmark({ label }: { label: string }) {
  return (
    <Link
      href="/"
      lang="en"
      className={`inline-flex items-center gap-2.5 rounded-md font-heading text-2xl leading-none font-extrabold tracking-[-0.03em] text-primary ${focusRing}`}
    >
      <Mark className="size-[30px]" />
      Maqsad
      <span className="sr-only">{label}</span>
    </Link>
  );
}
