import * as React from "react";
import { cn } from "@/lib/cn";

type SectionCardProps = React.HTMLAttributes<HTMLDivElement>;

export function SectionCard({
    className,
    children,
    ...props
}: SectionCardProps) {
    return (
        <section
            className={cn(
                "rounded-[16px] border border-[#E7E7EA] bg-white p-6 shadow-[0_10px_30px_rgba(0,0,0,0.06)]",
                className
            )}
            {...props}
        >
            {children}
        </section>
    );
}