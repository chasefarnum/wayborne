import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FrameForm } from "@/components/frame/frame-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Frame the trip · Wayborne",
};

export default async function FramePage({
  params,
}: {
  params: Promise<{ region: string }>;
}) {
  const { region: regionSlug } = await params;
  const supabase = await createClient();

  const { data: region } = await supabase
    .from("regions")
    .select("slug, name")
    .eq("slug", regionSlug)
    .maybeSingle();
  if (!region) notFound();

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 p-4 py-10">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {region.name}
        </p>
        <h1 className="text-2xl font-semibold">How much ride do you have?</h1>
        <p className="text-sm text-muted-foreground">
          Answer in rider terms. This sets the ruler every day gets measured against.
        </p>
      </header>
      <FrameForm regionSlug={region.slug} />
    </div>
  );
}
