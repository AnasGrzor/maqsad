import { ThreadPage } from "@/components/case-pages";

export default async function Page({ params }: PageProps<"/[locale]/student/messages/[id]">) {
  return <ThreadPage role="student" id={(await params).id} />;
}
