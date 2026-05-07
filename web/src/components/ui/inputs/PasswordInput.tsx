"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

type PasswordInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
    label?: string;
    error?: string;
};

export function PasswordInput({
    label,
    error,
    className,
    id,
    ...props
}: PasswordInputProps) {
    const [show, setShow] = React.useState(false);

    return (
        <div className="flex w-full flex-col gap-2">
            {label ? (
                <label htmlFor={id} className="text-sm font-medium text-[color:var(--text-primary)]">
                    {label}
                </label>
            ) : null}

            <div className="relative">
                <input
                    id={id}
                    type={show ? "text" : "password"}
                    className={cn(
                        "h-11 w-full rounded-[10px] border bg-[color:var(--surface-card)] px-3 pr-12 text-sm text-[color:var(--text-primary)]",
                        "border-[color:var(--border-subtle)] placeholder:text-[color:var(--text-muted)]",
                        "outline-none transition-colors focus:border-[color:var(--primary-500)]",
                        error && "border-[color:var(--primary-500)]",
                        className
                    )}
                    {...props}
                />

                <button
                    type="button"
                    onClick={() => setShow((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-[color:var(--text-secondary)]"
                >
                    {show ? "Hide" : "Show"}
                </button>
            </div>

            {error ? (
                <p className="text-xs text-[color:var(--primary-500)]">{error}</p>
            ) : null}
        </div>
    );
}