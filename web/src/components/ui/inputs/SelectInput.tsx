import * as React from "react";
import { cn } from "@/lib/cn";

type Option = {
    label: string;
    value: string;
};

type SelectInputProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
    label?: string;
    error?: string;
    options: Option[];
    placeholder?: string;
};

export function SelectInput({
    label,
    error,
    options,
    className,
    id,
    placeholder = "Select an option",
    ...props
}: SelectInputProps) {
    return (
        <div className="flex w-full flex-col gap-2">
            {label ? (
                <label htmlFor={id} className="text-sm font-medium text-gray-800">
                    {label}
                </label>
            ) : null}

            <select
                id={id}
                className={cn(
                    "h-11 w-full rounded-[10px] border bg-white px-3 text-sm text-gray-800",
                    "border-gray-200 outline-none transition-colors focus:border-red-500",
                    error && "border-red-500",
                    className
                )}
                {...props}
            >
                <option value="">{placeholder}</option>
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>

            {error ? (
                <p className="text-xs text-red-500">{error}</p>
            ) : null}
        </div>
    );
}