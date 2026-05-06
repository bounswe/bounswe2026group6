import * as React from "react";
import { cn } from "@/lib/cn";

type AuthCardProps = React.HTMLAttributes<HTMLDivElement>;

export function AuthCard({ className, children, ...props }: AuthCardProps) {
    return (
        <div
            className={cn(
                "w-full max-w-md rounded-[16px] border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] p-8 shadow-card",
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
}