import * as React from "react";

type PageTransitionProps = {
    children: React.ReactNode;
};

export function PageTransition({ children }: PageTransitionProps) {
    return <div className="page-transition-enter">{children}</div>;
}
