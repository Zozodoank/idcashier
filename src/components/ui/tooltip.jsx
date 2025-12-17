import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

export const TooltipProvider = TooltipPrimitive.Provider;
export const TooltipRoot = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = React.forwardRef(
  ({ className = "", sideOffset = 4, children, ...props }, ref) => (
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={
        "z-50 rounded-md bg-black px-3 py-1.5 text-sm text-white shadow-md animate-fade-in border border-black/10 min-w-[70px] max-w-xs text-center " +
        className
      }
      {...props}
    >
      {children}
    </TooltipPrimitive.Content>
  )
);
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

// Single export for use in JSX as <Tooltip>
export function Tooltip({ children, ...props }) {
  return (
    <TooltipRoot {...props}>{children}</TooltipRoot>
  );
}

