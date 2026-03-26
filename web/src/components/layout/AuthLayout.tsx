import * as React from "react";
import { AuthCard } from "@/components/ui/display/AuthCard";
import { PageContainer } from "@/components/layout/PageContainer";
import { AuthShowcase } from "@/components/feature/auth/AuthShowcase";

type AuthLayoutProps = {
    title?: string;
    subtitle?: string;
    children: React.ReactNode;
};

export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
    return (
        <div className="min-h-screen bg-gray-50">
            <PageContainer className="py-10">
                <div className="grid w-full max-w-6xl gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
                    <div className="hidden lg:sticky lg:top-10 lg:block">
                        <AuthShowcase />
                    </div>

                    <div className="flex items-start justify-center">
                        <AuthCard className="w-full max-w-md">
                            <div className="mb-6 flex flex-col items-center text-center">
                                <div className="mb-4 text-2xl font-bold text-red-500">
                                    NEPH
                                </div>

                                {title ? (
                                    <h1 className="text-3xl font-bold text-gray-800">
                                        {title}
                                    </h1>
                                ) : null}

                                {subtitle ? (
                                    <p className="mt-2 text-sm text-gray-500">
                                        {subtitle}
                                    </p>
                                ) : null}
                            </div>

                            {children}
                        </AuthCard>
                    </div>
                </div>
            </PageContainer>
        </div>
    );
}