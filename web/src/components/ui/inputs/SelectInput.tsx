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
    const emptyOption = options.find((option) => option.value === "");
    const displayValue = selectedOption?.label || "";
    const placeholderLabel = emptyOption?.label || placeholder;
    const hasExplicitEmptyOption = Boolean(emptyOption);

    return (
        <div className="flex w-full flex-col gap-2">
            {label ? (
                <label htmlFor={id} className="text-sm font-medium text-[color:var(--text-primary)]">
                    {label}
                </label>
            ) : null}

            <div
                className={cn(
                    "relative h-11 w-full rounded-[10px] border bg-[color:var(--surface-card)] transition-colors",
                    "border-[color:var(--border-subtle)] focus-within:border-[color:var(--primary-500)]",
                    error && "border-[color:var(--primary-500)]",
                    className
                )}
            >
                <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-3">
                    <span
                        className={cn(
                            "truncate text-sm",
                            displayValue ? "text-[color:var(--text-primary)]" : "text-[color:var(--text-muted)]"
                        )}
                    >
                        {displayValue || placeholderLabel}
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
                        className="text-[color:var(--text-muted)]"
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
                    {hasExplicitEmptyOption ? null : <option value="">{placeholder}</option>}

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
                <p className="text-xs text-[color:var(--primary-500)]">{error}</p>
            ) : helperText ? (
                <p className="text-xs text-[color:var(--text-muted)]">{helperText}</p>
            ) : null}
        </div>
    );
}