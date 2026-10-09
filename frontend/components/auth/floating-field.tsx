import { useId, type ComponentProps } from "react"

import { cn } from "@/lib/utils"

// Airbnb's text field: a 60px box where the label sits centred as a placeholder and floats
// up to 12px once the input is focused or has a value. Focus darkens the border to 2px ink
// (drawn with an inset shadow so the box doesn't shift). The label rests in the middle only
// while the input is empty and unfocused (placeholder is a single space, so it counts as
// "shown" exactly when empty); otherwise it sits floated.
export function FloatingField({
  label,
  invalid,
  className,
  ...props
}: { label: string; invalid?: boolean } & Omit<ComponentProps<"input">, "placeholder">) {
  const id = useId()
  return (
    <div
      className={cn(
        "relative h-[60px] rounded-xl border border-field bg-background transition-shadow focus-within:border-ink focus-within:shadow-[inset_0_0_0_1px_var(--ink)]",
        invalid && "border-error shadow-[inset_0_0_0_1px_var(--error)] focus-within:border-error focus-within:shadow-[inset_0_0_0_1px_var(--error)]",
        className
      )}
    >
      <input
        id={id}
        placeholder=" "
        aria-invalid={invalid || undefined}
        className="peer absolute inset-0 size-full rounded-xl bg-transparent px-4 pt-6 pb-1 text-base text-ink outline-none"
        {...props}
      />
      <label
        htmlFor={id}
        className="pointer-events-none absolute top-2.5 left-4 text-xs text-muted-foreground transition-all duration-150 peer-not-focus:peer-placeholder-shown:top-[19px] peer-not-focus:peer-placeholder-shown:text-base"
      >
        {label}
      </label>
    </div>
  )
}
