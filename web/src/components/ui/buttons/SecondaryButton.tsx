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
                "border border-red-500 bg-white px-4 text-sm font-semibold text-red-500",
                "transition-colors hover:bg-red-50 active:bg-red-100",
                "disabled:cursor-not-allowed disabled:opacity-60",
                className
            )}
            {...props}
        >
            {children}
        </button>
    );
}