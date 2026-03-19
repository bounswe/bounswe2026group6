import * as React from "react";
import { cn } from "@/lib/cn";

type TextInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
    label?: string;
    error?: string;
};

export function TextInput({
    label,
    error,
    className,
    id,
    ...props
}: TextInputProps) {
    return (
        <div className="flex w-full flex-col gap-2">
            {label ? (
                <label htmlFor={id} className="text-sm font-medium text-[#2B2B33]">
                    {label}
                </label>
            ) : null}

            <input
                id={id}
                className={cn(
                    "h-11 w-full rounded-[10px] border bg-white px-3 text-sm text-[#2B2B33]",
                    "border-[#E7E7EA] placeholder:text-[#A3A3AD]",
                    "outline-none transition-colors focus:border-[#D84A4A]",
                    error && "border-[#D84A4A]",
                    className
                )}
                {...props}
            />

            {error ? <p className="text-xs text-[#D84A4A]">{error}</p> : null}
        </div>
    );
}