import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[110px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 shadow-sm transition-colors outline-none resize-y",
          "focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-100",
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
Textarea.displayName = "Textarea";

export { Textarea };
