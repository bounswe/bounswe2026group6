import * as React from "react";
import { cn } from "@/lib/cn";

type TextAreaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    label?: string;
    error?: string;
};

export function TextArea({
    label,
    error,
    className,
    id,
    ...props
}: TextAreaProps) {
    return (
        <div className="flex w-full flex-col gap-2">
            {label ? (
                <label htmlFor={id} className="text-sm font-medium text-[color:var(--text-primary)]">
                    {label}
                </label>
            ) : null}

            <textarea
                id={id}
                className={cn(
                    "min-h-[110px] w-full rounded-[10px] border bg-[color:var(--surface-card)] px-3 py-3 text-sm text-[color:var(--text-primary)]",
                    "border-[color:var(--border-subtle)] placeholder:text-[color:var(--text-muted)]",
                    "outline-none transition-colors focus:border-[color:var(--primary-500)]",
                    "resize-none",
                    error && "border-[color:var(--primary-500)]",
                    className
                )}
                {...props}
            />

            {error ? (
                <p className="text-xs text-[color:var(--primary-500)]">{error}</p>
            ) : null}
        </div>
    );
}