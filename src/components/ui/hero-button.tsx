import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface HeroButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
}

const HeroButton = forwardRef<HTMLButtonElement, HeroButtonProps>(
  ({ className, variant = "primary", ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-2xl px-8 py-4 text-base font-semibold transition-all duration-300 hover:scale-105 hover:shadow-large disabled:pointer-events-none disabled:opacity-50",
          variant === "primary" && "bg-primary text-primary-foreground shadow-medium hover:bg-primary/90",
          variant === "secondary" && "bg-secondary text-secondary-foreground shadow-medium hover:bg-secondary/90",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

HeroButton.displayName = "HeroButton";

export { HeroButton };
