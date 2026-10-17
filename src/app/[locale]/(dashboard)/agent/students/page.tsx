import { getLocale, getTranslations } from "next-intl/server";
import { PageHeading } from "@/components/feature-list";
import { FilterBar, pick, StudentCard } from "@/components/listings";
import { requireRole } from "@/lib/auth";
import { listStudentsForAgent, namesOf } from "@/lib/data";
import { COUNTRIES, countryName, FIELDS, GOALS, LEVELS } from "@/lib/taxonomy";

export default async function StudentDiscovery({ searchParams }: PageProps<"/[locale]/agent/students">) {
  await requireRole("agent");
  const [t, tax, locale, params, students] = await Promise.all([
    getTranslations("discovery"),
    getTranslations("taxonomy"),
    getLocale(),
    searchParams,
    listStudentsForAgent(),
  ]);
  const destination = pick(params.destination, COUNTRIES);
  const level = pick(params.level, LEVELS);
  const field = pick(params.field, FIELDS);
  const goal = pick(params.goal, GOALS);

  // Discovery lists only students who opted in; connected students who later hid stay under Connections.
  const shown = students
    .filter((s) => s.visible)
    .filter((s) => !destination || s.destinations.includes(destination))
    .filter((s) => !level || s.education_level === level)
    .filter((s) => !field || s.field === field)
    .filter((s) => !goal || s.goal === goal || s.goal === "both");
  const names = await namesOf(shown.map((s) => s.user_id));

  return (
    <div className="space-y-6">
      <PageHeading title={t("title")} intro={t("intro")} />
      <FilterBar
        filters={[
          { name: "destination", label: t("destination"), value: destination, options: COUNTRIES.map((c) => ({ value: c, label: countryName(c, locale) })) },
          { name: "level", label: t("level"), value: level, options: LEVELS.map((l) => ({ value: l, label: tax(`levels.${l}`) })) },
          { name: "field", label: t("field"), value: field, options: FIELDS.map((f) => ({ value: f, label: tax(`fields.${f}`) })) },
          { name: "goal", label: t("goal"), value: goal, options: GOALS.map((g) => ({ value: g, label: tax(`goals.${g}`) })) },
        ]}
      />
      <p className="text-sm font-medium">{t("results", { count: shown.length })}</p>
      <ul className="grid gap-4 md:grid-cols-2">
        {shown.map((s) => (
          <StudentCard key={s.user_id} student={s} name={names.get(s.user_id)} />
        ))}
      </ul>
    </div>
  );
}
