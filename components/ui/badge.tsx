import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/** One badge for every status, tag and label. Colour carries meaning; the text always says it too. */
export const badgeVariants = cva("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm leading-5 font-medium whitespace-nowrap", {
  variants: {
    variant: {
      neutral: "bg-muted text-muted-foreground",
      accent: "bg-primary/12 text-primary",
      warning: "bg-warning/15 text-warning-foreground",
      danger: "bg-destructive/12 text-destructive",
      outline: "border border-dashed border-muted-foreground/50 text-muted-foreground",
    },
  },
  defaultVariants: { variant: "neutral" },
});

export function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
