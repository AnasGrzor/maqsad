import { DashboardShell } from "@/components/dashboard-shell";

export default function Layout({ children }: LayoutProps<"/[locale]/student">) {
  return <DashboardShell role="student">{children}</DashboardShell>;
}
