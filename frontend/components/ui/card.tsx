import { cn } from "@/lib/utils/cn";

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("rounded-xl border border-[#E7E7E2] bg-white", className)}
    >
      {children}
    </div>
  );
}
