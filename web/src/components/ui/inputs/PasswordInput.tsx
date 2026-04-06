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
                <label htmlFor={id} className="text-sm font-medium text-gray-800">
                    {label}
                </label>
            ) : null}

            <div className="relative">
                <input
                    id={id}
                    type={show ? "text" : "password"}
                    className={cn(
                        "h-11 w-full rounded-[10px] border bg-white px-3 pr-12 text-sm text-gray-800",
                        "border-gray-200 placeholder:text-gray-400",
                        "outline-none transition-colors focus:border-red-500",
                        error && "border-red-500",
                        className
                    )}
                    {...props}
                />

                <button
                    type="button"
                    onClick={() => setShow((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-500"
                >
                    {show ? "Hide" : "Show"}
                </button>
            </div>

            {error ? (
                <p className="text-xs text-red-500">{error}</p>
            ) : null}
        </div>
    );
}