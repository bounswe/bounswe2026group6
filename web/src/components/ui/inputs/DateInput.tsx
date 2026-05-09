import * as React from "react";
import { cn } from "@/lib/cn";

type DateInputProps = {
    id?: string;
    label?: string;
    value: string;
    onChange: (value: string) => void;
    error?: string;
    className?: string;
};

function autoFormat(raw: string): string {
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    let out = "";
    for (let i = 0; i < digits.length; i++) {
        if (i === 4 || i === 6) out += "-";
        out += digits[i];
    }
    return out;
}

/**
 * ISO date input (YYYY-MM-DD).
 *
 * - Typing: accepts digits only, inserts dashes automatically.
 * - Calendar icon: opens a hidden <input type="date"> picker; selected date
 *   syncs back to the text field and vice-versa.
 */
export function DateInput({ id, label, value, onChange, error, className }: DateInputProps) {
    const pickerRef = React.useRef<HTMLInputElement>(null);

    function handleTextChange(e: React.ChangeEvent<HTMLInputElement>) {
        const formatted = autoFormat(e.target.value);
        if (formatted.length === 10) {
            const today = new Date().toISOString().slice(0, 10);
            if (formatted > today) return; // reject future dates
        }
        onChange(formatted);
    }

    function handlePickerChange(e: React.ChangeEvent<HTMLInputElement>) {
        onChange(e.target.value); // already YYYY-MM-DD
    }

    return (
        <div className="flex w-full flex-col gap-2">
            {label ? (
                <label
                    htmlFor={id}
                    className="text-sm font-medium text-[color:var(--text-primary)]"
                >
                    {label}
                </label>
            ) : null}

            <div className="relative flex items-center">
                <input
                    id={id}
                    type="text"
                    inputMode="numeric"
                    placeholder="YYYY-MM-DD"
                    value={value}
                    onChange={handleTextChange}
                    maxLength={10}
                    className={cn(
                        "h-11 w-full rounded-[10px] border bg-[color:var(--surface-card)] px-3 pr-10 text-sm text-[color:var(--text-primary)]",
                        "border-[color:var(--border-subtle)] placeholder:text-[color:var(--text-muted)]",
                        "outline-none transition-colors focus:border-[color:var(--primary-500)]",
                        error && "border-[color:var(--primary-500)]",
                        className
                    )}
                />

                {/* hidden native date picker — triggered only by calendar icon button */}
                <input
                    ref={pickerRef}
                    type="date"
                    value={value}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={handlePickerChange}
                    className="pointer-events-none absolute h-0 w-0 opacity-0"
                    tabIndex={-1}
                    aria-hidden="true"
                />

                <button
                    type="button"
                    onClick={() => pickerRef.current?.showPicker?.()}
                    className="absolute right-3 text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]"
                    aria-label="Open calendar"
                    tabIndex={-1}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                </button>
            </div>

            {error ? (
                <p className="text-xs text-[color:var(--primary-500)]">{error}</p>
            ) : null}
        </div>
    );
}
