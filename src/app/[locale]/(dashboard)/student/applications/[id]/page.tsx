import { CasePage } from "@/components/case-pages";

export default async function Page({ params }: PageProps<"/[locale]/student/applications/[id]">) {
  return <CasePage role="student" id={(await params).id} />;
}
