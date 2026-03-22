"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

type VerificationCodeInputProps = {
    length?: number;
    value: string;
    onChange: (value: string) => void;
    className?: string;
};

export function VerificationCodeInput({
    length = 6,
    value,
    onChange,
    className,
}: VerificationCodeInputProps) {
    const inputsRef = React.useRef<Array<HTMLInputElement | null>>([]);

    const values = Array.from({ length }, (_, i) => value[i] || "");

    const handleChange = (index: number, nextChar: string) => {
        const char = nextChar.slice(-1);
        const nextValues = [...values];
        nextValues[index] = char;

        const nextValue = nextValues.join("");
        onChange(nextValue);

        if (char && index < length - 1) {
            inputsRef.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (
        index: number,
        e: React.KeyboardEvent<HTMLInputElement>
    ) => {
        if (e.key === "Backspace" && !values[index] && index > 0) {
            inputsRef.current[index - 1]?.focus();
        }
    };

    return (
        <div className={cn("flex gap-2", className)}>
            {values.map((digit, index) => (
                <input
                    key={index}
                    ref={(el) => {
                        inputsRef.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    className="h-12 w-12 rounded-[10px] border border-gray-200 bg-white text-center text-lg font-semibold text-gray-800 outline-none transition-colors focus:border-red-500"
                />
            ))}
        </div>
    );
}