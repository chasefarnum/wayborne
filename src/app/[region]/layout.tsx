import { AppShell } from "@/components/frame/app-shell";

// Every region surface (plan, days, and their loading states) lives inside
// the app frame; pages own the region name and their content layout.
export default async function RegionLayout({
  params,
  children,
}: {
  params: Promise<{ region: string }>;
  children: React.ReactNode;
}) {
  const { region: regionSlug } = await params;
  return <AppShell regionSlug={regionSlug}>{children}</AppShell>;
}
