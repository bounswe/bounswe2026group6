import * as React from "react";
import { cn } from "@/lib/cn";

type SelectOption = {
    label: string;
    value: string;
    shortLabel?: string;
};

type SelectInputProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
    id: string;
    label: string;
    options: SelectOption[];
    error?: string;
    helperText?: string;
    placeholder?: string;
};

export function SelectInput({
    id,
    label,
    options,
    error,
    helperText,
    placeholder,
    className,
    value,
    ...props
}: SelectInputProps) {
    const selectedOption = options.find((option) => option.value === value);

    return (
        <div className="flex w-full flex-col gap-1.5">
            <label htmlFor={id} className="text-sm font-medium text-[#2B2B33]">
                {label}
            </label>

            <div
                className={cn(
                    "relative h-12 w-full rounded-[10px] border border-[#E7E7EA] bg-white transition-colors focus-within:border-[#D84A4A]",
                    error ? "border-[#D84A4A]" : ""
                )}
            >
                <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-4 pr-10">
                    <span
                        className={cn(
                            "truncate text-sm",
                            selectedOption ? "text-[#2B2B33]" : "text-[#A3A3AD]"
                        )}
                    >
                        {selectedOption?.shortLabel || placeholder || "Select"}
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
                    className={cn(
                        "absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0",
                        className
                    )}
                    {...props}
                >
                    {placeholder ? (
                        <option value="">{placeholder}</option>
                    ) : null}

                    {options.map((option, index) => (
                        <option
                            key={`${option.value}-${option.label}-${index}`}
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