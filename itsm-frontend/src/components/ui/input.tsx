import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  invalid?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, leadingIcon, trailingIcon, invalid, ...props }, ref) => {
    if (leadingIcon || trailingIcon) {
      return (
        <div className="relative flex items-center">
          {leadingIcon && (
            <span className="pointer-events-none absolute left-3 flex items-center text-slate-400 [&_svg]:size-4">
              {leadingIcon}
            </span>
          )}
          <input
            type={type}
            className={cn(
              "flex h-9 w-full rounded-[5px] border border-[#d0d5dd] bg-white text-[13px] text-[#1d2433] placeholder:text-[#98a2b3] shadow-none transition-colors outline-none",
              "focus-visible:border-brand-600 focus-visible:ring-2 focus-visible:ring-[#e3ebfb]",
              "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
              leadingIcon ? "pl-10" : "pl-3",
              trailingIcon ? "pr-10" : "pr-3",
              invalid && "border-red-400 focus-visible:border-red-500 focus-visible:ring-red-100",
              className
            )}
            ref={ref}
            {...props}
          />
          {trailingIcon && (
            <span className="absolute right-3 flex items-center text-slate-400 [&_svg]:size-4">
              {trailingIcon}
            </span>
          )}
        </div>
      );
    }

    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-[5px] border border-[#d0d5dd] bg-white px-3 text-[13px] text-[#1d2433] placeholder:text-[#98a2b3] shadow-none transition-colors outline-none",
          "focus-visible:border-brand-600 focus-visible:ring-2 focus-visible:ring-[#e3ebfb]",
          "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
          invalid && "border-red-400 focus-visible:border-red-500 focus-visible:ring-red-100",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
