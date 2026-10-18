import { ThreadPage } from "@/components/case-pages";

export default async function Page({ params }: PageProps<"/[locale]/agent/messages/[id]">) {
  return <ThreadPage role="agent" id={(await params).id} />;
}
