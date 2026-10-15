import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const buttonVariants = cva(
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-5 text-base font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B95F43] disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-[#B95F43] text-white hover:bg-[#A9553B]",
        secondary:
          "border border-[#E7E7E2] bg-white text-[#202B3C] hover:bg-[#F8F8F5]",
        ghost: "text-[#202B3C] hover:bg-[#F8F8F5] min-h-0 px-3 py-2",
        destructive: "bg-red-700 text-white hover:bg-red-800",
      },
      size: {
        md: "",
        sm: "min-h-[36px] px-3 text-sm",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ variant, size, className, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}
