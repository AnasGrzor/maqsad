import { CasePage } from "@/components/case-pages";

export default async function Page({ params }: PageProps<"/[locale]/agent/applications/[id]">) {
  return <CasePage role="agent" id={(await params).id} />;
}
