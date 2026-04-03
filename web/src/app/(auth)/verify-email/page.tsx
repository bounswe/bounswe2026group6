import { Suspense } from "react";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { AuthRouteGate } from "@/components/auth/AuthRouteGate";
import { VerifyEmailForm } from "@/components/feature/auth/VerifyEmailForm";

export default function VerifyEmailPage() {
    return (
        <Suspense>
            <AuthRouteGate mode="guest-only">
                <AuthLayout
                    title="Verify Email"
                    subtitle="Use the verification link sent to your email, or resend it from this page."
                >
                    <VerifyEmailForm />
                </AuthLayout>
            </AuthRouteGate>
        </Suspense>
    );
}
