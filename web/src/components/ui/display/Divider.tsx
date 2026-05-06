import * as React from "react";
import { cn } from "@/lib/cn";

type DividerProps = React.HTMLAttributes<HTMLHRElement>;

export function Divider({ className, ...props }: DividerProps) {
    return (
        <hr
            className={cn("border-0 border-t border-[color:var(--divider)]", className)}
            {...props}
        />
    );
}