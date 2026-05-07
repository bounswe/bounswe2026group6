import * as React from "react";
import { cn } from "@/lib/cn";

type PrimaryButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    loading?: boolean;
};

export function PrimaryButton({
    className,
    children,
    loading = false,
    disabled,
    ...props
}: PrimaryButtonProps) {
    return (
        <button
            className={cn(
                "inline-flex h-11 w-full items-center justify-center rounded-[10px]",
                "bg-[color:var(--primary-500)] px-4 text-sm font-semibold text-[color:var(--text-on-primary)]",
                "transition-colors hover:bg-[color:var(--primary-600)] active:bg-[color:var(--primary-700)]",
                "disabled:cursor-not-allowed disabled:opacity-60",
                className
            )}
            disabled={disabled || loading}
            {...props}
        >
            {loading ? "Loading..." : children}
        </button>
    );
}