import * as React from "react";
import { cn } from "@/lib/cn";

type SecondaryButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

export function SecondaryButton({
    className,
    children,
    ...props
}: SecondaryButtonProps) {
    return (
        <button
            className={cn(
                "inline-flex h-11 w-full items-center justify-center rounded-[10px]",
                "border border-[color:var(--primary-500)] bg-[color:var(--surface-card)] px-4 text-sm font-semibold text-[color:var(--primary-500)]",
                "transition-colors hover:bg-[color:var(--primary-100)] active:bg-[color:var(--primary-soft-200)]",
                "disabled:cursor-not-allowed disabled:opacity-60",
                className
            )}
            {...props}
        >
            {children}
        </button>
    );
}