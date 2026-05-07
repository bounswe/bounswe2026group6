import * as React from "react";
import { cn } from "@/lib/cn";

type HelperTextProps = React.HTMLAttributes<HTMLParagraphElement>;

export function HelperText({
    className,
    children,
    ...props
}: HelperTextProps) {
    return (
        <p className={cn("text-xs text-[color:var(--text-secondary)]", className)} {...props}>
            {children}
        </p>
    );
}