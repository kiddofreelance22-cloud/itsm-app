import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  leadingIcon?: React.ReactNode;
  invalid?: boolean;
}

/**
 * A styled native <select>. Using the native element keeps keyboard access,
 * screen-reader semantics, and mobile behavior correct for free, while
 * matching the design's rounded field with a leading icon and chevron.
 */
const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, leadingIcon, invalid, children, ...props }, ref) => {
    return (
      <div className="relative flex items-center">
        {leadingIcon && (
          <span className="pointer-events-none absolute left-3 flex items-center text-slate-400 [&_svg]:size-4">
            {leadingIcon}
          </span>
        )}
        <select
          ref={ref}
          className={cn(
            "h-11 w-full appearance-none rounded-lg border border-slate-300 bg-white text-sm text-slate-800 shadow-sm outline-none transition-colors",
            "focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-100",
            "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
            leadingIcon ? "pl-10" : "pl-3",
            "pr-9",
            invalid && "border-red-400 focus-visible:border-red-500 focus-visible:ring-red-100",
            className
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 size-4 text-slate-400"
          aria-hidden="true"
        />
      </div>
    );
  }
);
Select.displayName = "Select";

export { Select };
