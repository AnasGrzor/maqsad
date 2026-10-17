"use client";

import { useFormatter, useTranslations } from "next-intl";
import type { Connection, RiskLevel } from "@/lib/schema";

// Same tones as RISK in report-view.tsx.
const RISK: Record<RiskLevel, { chip: string; fill: string; stroke: string; text: string }> = {
  high: { chip: "bg-danger text-white", fill: "fill-danger", stroke: "stroke-danger", text: "fill-white" },
  medium: { chip: "bg-lemon text-navy-900", fill: "fill-lemon", stroke: "stroke-lemon", text: "fill-navy-900" },
  low: { chip: "bg-mint text-navy-900", fill: "fill-mint", stroke: "stroke-mint", text: "fill-navy-900" },
  incomplete: { chip: "bg-fog text-navy-900", fill: "fill-fog", stroke: "stroke-fog", text: "fill-navy-900" },
};

const KIND_SHORT: Record<Connection["kind"], string> = { domain: "www", email: "@", phone: "tel", payee: "pay", account: "a/c" };

type Case = Connection["cases"][number];
const caseKey = (c: Case) => `${c.checked_at}|${c.doc_type}|${c.issuer_name}|${c.risk}`;

// Graph geometry, in viewBox units.
const W = 320;
const H = 260;
const CX = W / 2;
const CY = H / 2;
const R_ID = 64;
const R_CASE = 108;
const at = (r: number, a: number) => [CX + r * Math.cos(a), CY + r * Math.sin(a)] as const;

export function Connections({ connections }: { connections: Connection[] }) {
  const t = useTranslations("checker");
  const format = useFormatter();
  if (!connections.length) return null;

  // Number each earlier check once, even when it shares several details with this document.
  const number = new Map<string, number>();
  for (const c of connections) for (const k of c.cases) if (!number.has(caseKey(k))) number.set(caseKey(k), number.size + 1);
  const n = number.size;

  // Identifiers sit evenly around the document; each check fans out beside the first identifier it shares.
  const ids = connections.map((c, i) => ({ c, angle: -Math.PI / 2 + (2 * Math.PI * i) / connections.length }));
  const placed = new Map<string, { x: number; y: number; risk: RiskLevel; n: number }>();
  for (const { c, angle } of ids) {
    const fresh = c.cases.filter((k) => !placed.has(caseKey(k)));
    const step = Math.min(0.42, ((2 * Math.PI) / connections.length / Math.max(fresh.length, 1)) * 0.85);
    fresh.forEach((k, j) => {
      const [x, y] = at(R_CASE, angle + (j - (fresh.length - 1) / 2) * step);
      placed.set(caseKey(k), { x, y, risk: k.risk, n: number.get(caseKey(k))! });
    });
  }

  return (
    <section aria-labelledby="connections-heading" className="rounded-2xl bg-card p-5 ring-1 ring-fog sm:p-6">
      <h3 id="connections-heading" className="text-lg font-semibold tracking-tight">
        {t("connections.title")}
      </h3>
      <p className="mt-1 max-w-[68ch] text-sm text-pretty text-slate">
        {t("connections.intro", { count: n })}
      </p>

      <svg viewBox={`0 0 ${W} ${H}`} aria-hidden className="mx-auto mt-4 block h-auto w-full max-w-sm">
        {ids.flatMap(({ c, angle }) => {
          const [ix, iy] = at(R_ID, angle);
          return c.cases.map((k) => {
            const p = placed.get(caseKey(k))!;
            return (
              <g key={`${c.kind}${c.value}${caseKey(k)}`}>
                <line x1={ix} y1={iy} x2={p.x} y2={p.y} strokeWidth={5} className="stroke-navy-900" />
                <line x1={ix} y1={iy} x2={p.x} y2={p.y} strokeWidth={3} className={RISK[k.risk].stroke} />
              </g>
            );
          });
        })}
        {ids.map(({ c, angle }) => {
          const [x, y] = at(R_ID, angle);
          return (
            <g key={c.kind + c.value}>
              <line x1={CX} y1={CY} x2={x} y2={y} strokeWidth={1.5} className="stroke-mist" />
              <circle cx={x} cy={y} r={14} strokeWidth={1.5} className="fill-lavender-200 stroke-navy-800" />
              <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={9} className="fill-navy-900 font-semibold">
                {KIND_SHORT[c.kind]}
              </text>
            </g>
          );
        })}
        <rect x={CX - 44} y={CY - 13} width={88} height={26} rx={13} className="fill-navy-900" />
        <text x={CX} y={CY} textAnchor="middle" dominantBaseline="central" fontSize={10} className="fill-ice font-medium">
          {t("connections.thisDocument")}
        </text>
        {[...placed.values()].map((p) => (
          <g key={p.n}>
            <circle cx={p.x} cy={p.y} r={10} strokeWidth={1.5} className={`${RISK[p.risk].fill} stroke-navy-900`} />
            <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" fontSize={9} className={`${RISK[p.risk].text} font-semibold`}>
              {p.n}
            </text>
          </g>
        ))}
      </svg>

      <ul className="mt-4 divide-y divide-fog text-sm">
        {connections.map((c) => (
          <li key={c.kind + c.value} className="py-3 first:pt-0 last:pb-0">
            <p>
              <span className="text-slate">{t(`connections.kind.${c.kind}`)}: </span>
              <span className="font-medium [overflow-wrap:anywhere]">{c.value}</span>
            </p>
            <p className="mt-1 text-slate">
              {t("connections.alsoIn", { count: c.cases.length })}
            </p>
            <ul className="mt-1.5 space-y-1.5">
              {c.cases.map((k) => (
                <li key={caseKey(k)} className="flex gap-2.5">
                  <span
                    aria-hidden
                    className={`grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold tabular-nums ring-1 ring-navy-900 ${RISK[k.risk].chip}`}
                  >
                    {number.get(caseKey(k))}
                  </span>
                  <span className="min-w-0 [overflow-wrap:anywhere]">
                    <span className="font-medium">{t(`risk.${k.risk}.title`)}</span>
                    {" · "}
                    {t(`docType.${k.doc_type}`)}
                    {k.issuer_name && ` ${t("connections.from", { issuer: k.issuer_name })}`}
                    {" · "}
                    <time dateTime={k.checked_at}>
                      {format.dateTime(new Date(k.checked_at), { day: "numeric", month: "short", year: "numeric" })}
                    </time>
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
