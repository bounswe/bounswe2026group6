import * as React from "react";
import { cn } from "@/lib/cn";

type PageContainerProps = React.HTMLAttributes<HTMLDivElement>;

export function PageContainer({
    className,
    children,
    ...props
}: PageContainerProps) {
    return (
        <div
            className={cn("mx-auto w-full max-w-6xl px-4 md:px-6", className)}
            {...props}
        >
            {children}
        </div>
    );
}