import { DashboardShell } from "@/components/dashboard-shell";

export default function Layout({ children }: LayoutProps<"/[locale]/agent">) {
  return <DashboardShell role="agent">{children}</DashboardShell>;
}
