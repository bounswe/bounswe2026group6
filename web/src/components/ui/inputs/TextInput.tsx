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
                <label htmlFor={id} className="text-sm font-medium text-gray-800">
                    {label}
                </label>
            ) : null}

            <input
                id={id}
                className={cn(
                    "h-11 w-full rounded-[10px] border bg-white px-3 text-sm text-gray-800",
                    "border-gray-200 placeholder:text-gray-400",
                    "outline-none transition-colors focus:border-red-500",
                    error && "border-red-500",
                    className
                )}
                {...props}
            />

            {error ? (
                <p className="text-xs text-red-500">{error}</p>
            ) : null}
        </div>
    );
}