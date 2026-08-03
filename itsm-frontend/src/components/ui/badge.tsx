import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        blue: "bg-blue-50 text-blue-700",
        green: "bg-green-50 text-green-700",
        gray: "bg-slate-100 text-slate-600",
        amber: "bg-amber-50 text-amber-700",
        red: "bg-red-50 text-red-700",
        purple: "bg-purple-50 text-purple-700",
      },
      dot: {
        true: "",
        false: "",
      },
    },
    defaultVariants: {
      variant: "gray",
      dot: false,
    },
  }
);

const dotColor: Record<string, string> = {
  blue: "bg-blue-600",
  green: "bg-green-600",
  gray: "bg-slate-500",
  amber: "bg-amber-500",
  red: "bg-red-600",
  purple: "bg-purple-600",
};

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && (
        <span
          className={cn("size-1.5 rounded-full", dotColor[variant ?? "gray"])}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
