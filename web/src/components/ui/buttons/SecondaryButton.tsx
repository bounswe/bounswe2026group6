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
                "border border-[#D84A4A] bg-white px-4 text-sm font-semibold text-[#D84A4A]",
                "transition-colors hover:bg-[#FDECEC] active:bg-[#F9DDDD]",
                "disabled:cursor-not-allowed disabled:opacity-60",
                className
            )}
            {...props}
        >
            {children}
        </button>
    );
}