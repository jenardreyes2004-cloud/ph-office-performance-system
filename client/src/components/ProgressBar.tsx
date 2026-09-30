import { cn } from "@/lib/utils";

/** Determinate progress bar. `value` is a percentage, clamped to 0–100. */
export function ProgressBar({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Number(value) || 0));
  const tone =
    clamped >= 100
      ? "bg-emerald-600"
      : clamped >= 50
        ? "bg-primary"
        : clamped > 0
          ? "bg-amber-500"
          : "bg-muted-foreground/30";

  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${clamped}%` }} />
    </div>
  );
}
