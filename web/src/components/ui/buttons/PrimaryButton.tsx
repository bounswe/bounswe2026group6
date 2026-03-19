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
                "bg-[#D84A4A] px-4 text-sm font-semibold text-white",
                "transition-colors hover:bg-[#C53E3E] active:bg-[#A93232]",
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