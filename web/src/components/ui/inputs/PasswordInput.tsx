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
                <label htmlFor={id} className="text-sm font-medium text-[#2B2B33]">
                    {label}
                </label>
            ) : null}

            <div className="relative">
                <input
                    id={id}
                    type={show ? "text" : "password"}
                    className={cn(
                        "h-11 w-full rounded-[10px] border bg-white px-3 pr-12 text-sm text-[#2B2B33]",
                        "border-[#E7E7EA] placeholder:text-[#A3A3AD]",
                        "outline-none transition-colors focus:border-[#D84A4A]",
                        error && "border-[#D84A4A]",
                        className
                    )}
                    {...props}
                />

                <button
                    type="button"
                    onClick={() => setShow((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-[#737380]"
                >
                    {show ? "Hide" : "Show"}
                </button>
            </div>

            {error ? <p className="text-xs text-[#D84A4A]">{error}</p> : null}
        </div>
    );
}