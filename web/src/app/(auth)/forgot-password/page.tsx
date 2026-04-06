import { Suspense } from "react";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { AuthRouteGate } from "@/components/auth/AuthRouteGate";
import { ForgotPasswordForm } from "@/components/feature/auth/ForgotPasswordForm";

export default function ForgotPasswordPage() {
    return (
        <Suspense>
            <AuthRouteGate mode="guest-only">
                <AuthLayout
                    title="Forgot Password"
                    subtitle="Enter your email address and we will send you a reset link."
                >
                    <ForgotPasswordForm />
                </AuthLayout>
            </AuthRouteGate>
        </Suspense>
    );
}
