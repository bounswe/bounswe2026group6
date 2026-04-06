import * as React from "react";
import { cn } from "@/lib/cn";

type AuthCardProps = React.HTMLAttributes<HTMLDivElement>;

export function AuthCard({ className, children, ...props }: AuthCardProps) {
    return (
        <div
            className={cn(
                "w-full max-w-md rounded-[16px] border border-gray-200 bg-white p-8 shadow-[0_10px_30px_rgba(0,0,0,0.06)]",
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
}