import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  copy,
  action,
}: {
  icon: LucideIcon;
  title: string;
  copy: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-[#E7E7E2] bg-white px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F8F8F5]">
        <Icon className="h-6 w-6 text-[#687386]" aria-hidden />
      </span>
      <h2 className="text-lg font-semibold text-[#202B3C]">{title}</h2>
      <p className="max-w-sm text-sm text-[#687386]">{copy}</p>
      {action}
    </div>
  );
}
