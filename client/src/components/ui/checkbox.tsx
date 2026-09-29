import * as React from "react"

import { cn } from "@/lib/utils"

function Checkbox({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type="checkbox"
      data-slot="checkbox"
      className={cn(
        "peer size-4 shrink-0 rounded-sm border border-input shadow-xs transition-shadow outline-none",
        "accent-primary",
        "focus-visible:ring-2 focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

function CheckboxLabel({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="checkbox-label"
      className={cn("text-sm leading-none select-none", className)}
      {...props}
    />
  )
}

export { Checkbox, CheckboxLabel }
