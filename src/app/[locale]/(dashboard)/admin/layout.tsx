import { DashboardShell } from "@/components/dashboard-shell";

export default function Layout({ children }: LayoutProps<"/[locale]/admin">) {
  return <DashboardShell role="admin">{children}</DashboardShell>;
}
