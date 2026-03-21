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
    helperText?: string;
    placeholder?: string;
};

export function SelectInput({
    label,
    error,
    options,
    helperText,
    className,
    id,
    placeholder = "Select an option",
    value,
    ...props
}: SelectInputProps) {
    const selectedOption = options.find((option) => option.value === value);
    const displayValue = selectedOption ? selectedOption.value : "";

    return (
        <div className="flex w-full flex-col gap-2">
            {label ? (
                <label htmlFor={id} className="text-sm font-medium text-[#2B2B33]">
                    {label}
                </label>
            ) : null}

            <div
                className={cn(
                    "relative h-11 w-full rounded-[10px] border bg-white transition-colors",
                    "border-[#E7E7EA] focus-within:border-[#D84A4A]",
                    error && "border-[#D84A4A]",
                    className
                )}
            >
                <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-3">
                    <span
                        className={cn(
                            "truncate text-sm",
                            displayValue ? "text-[#2B2B33]" : "text-[#A3A3AD]"
                        )}
                    >
                        {displayValue || placeholder}
                    </span>

                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-[#737380]"
                    >
                        <path d="m6 9 6 6 6-6" />
                    </svg>
                </div>

                <select
                    id={id}
                    value={value}
                    className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
                    {...props}
                >
                    <option value="">{placeholder}</option>

                    {options.map((option) => (
                        <option
                            key={`${option.label}-${option.value}`}
                            value={option.value}
                        >
                            {option.label}
                        </option>
                    ))}
                </select>
            </div>

            {error ? (
                <p className="text-xs text-[#D84A4A]">{error}</p>
            ) : helperText ? (
                <p className="text-xs text-[#737380]">{helperText}</p>
            ) : null}
        </div>
    );
}