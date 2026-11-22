import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Ligne button hierarchy: one solid primary per screen, an outlined secondary, and a
// tertiary text link. Focus uses the global ink ring from styles.css.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius)] text-[15px] font-bold cursor-pointer transition-colors duration-150 disabled:pointer-events-none disabled:opacity-45 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        /** Primary: solid ink. */
        default: "bg-ink text-white hover:bg-ink/85",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        /** Secondary: 1.5 px ink outline. */
        outline: "border-[1.5px] border-ink bg-transparent text-ink hover:bg-paper-2",
        secondary: "bg-paper-2 text-ink hover:bg-rule",
        ghost: "text-ink hover:bg-paper-2",
        /** Tertiary: underlined text. */
        link: "h-auto px-0 text-ink underline underline-offset-4 decoration-1 hover:decoration-2",
        pill: "rounded-full border border-rule bg-transparent font-normal text-ink hover:border-ink data-[active=true]:bg-ink data-[active=true]:text-white data-[active=true]:border-ink",
        join: "border-[1.5px] border-ink bg-transparent text-ink hover:bg-ink hover:text-white",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-9 px-3 text-sm",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
