import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const config = {
  error: { Icon: AlertCircle, cls: "border-red-200 bg-red-50 text-red-900" },
  success: { Icon: CheckCircle2, cls: "border-green-200 bg-green-50 text-green-900" },
  info: { Icon: Info, cls: "border-[#E7E7E2] bg-[#F8F8F5] text-[#202B3C]" },
} as const;

export function Alert({
  tone = "info",
  title,
  children,
  action,
}: {
  tone?: keyof typeof config;
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  const { Icon, cls } = config[tone];
  return (
    <div role="alert" className={cn("flex gap-3 rounded-xl border p-4", cls)}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div className="flex-1 text-sm">
        {title && <p className="font-semibold">{title}</p>}
        <div>{children}</div>
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}
