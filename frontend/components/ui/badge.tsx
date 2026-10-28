import { cn } from "@/lib/utils/cn";

const styles: Record<string, string> = {
  ACTIVE: "bg-green-50 text-green-800 border-green-200",
  CONFIRMED: "bg-[#202B3C] text-white border-[#202B3C]",
  SUSPENDED: "bg-amber-50 text-amber-800 border-amber-200",
  CANCELLED: "bg-slate-100 text-slate-600 border-slate-200",
  SOLDOUT: "bg-slate-100 text-slate-600 border-slate-200",
  FREE: "bg-green-50 text-green-800 border-green-200",
  DEFAULT: "bg-white text-[#687386] border-[#E7E7E2]",
};

export function Badge({
  tone = "DEFAULT",
  children,
  className,
}: {
  tone?: keyof typeof styles;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        styles[tone] ?? styles.DEFAULT,
        className,
      )}
    >
      {children}
    </span>
  );
}
