import * as React from "react";
import { AuthCard } from "@/components/ui/display/AuthCard";
import { PageContainer } from "@/components/layout/PageContainer";

type AuthLayoutProps = {
    title?: string;
    subtitle?: string;
    children: React.ReactNode;
};

export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
    return (
        <div className="min-h-screen bg-[#F8F8F9]">
            <PageContainer className="flex min-h-screen items-center justify-center py-10">
                <AuthCard>
                    <div className="mb-6 flex flex-col items-center text-center">
                        <div className="mb-4 text-2xl font-bold text-[#D84A4A]">NEPH</div>
                        {title ? (
                            <h1 className="text-3xl font-bold text-[#2B2B33]">{title}</h1>
                        ) : null}
                        {subtitle ? (
                            <p className="mt-2 text-sm text-[#737380]">{subtitle}</p>
                        ) : null}
                    </div>

                    {children}
                </AuthCard>
            </PageContainer>
        </div>
    );
}