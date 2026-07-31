import { CompassStamp } from "@/components/frame/logo";
import { cn } from "@/lib/utils";

// Mann sky plate (review P2): empty and loading states are named ceremony
// moments, so they get the brand register — dusk gradient, grain, the
// circular stamp, serif-italic voice. A brand surface: bone ink only, never
// the cool working palette. Content stays above the ::after grain layer.
export function SkyPlate({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("sky-mann overflow-hidden rounded-md p-5 text-bone", className)}>
      <div className="relative z-10 flex flex-col gap-3">
        <CompassStamp size={28} className="text-bone/80" />
        {children}
      </div>
    </div>
  );
}
