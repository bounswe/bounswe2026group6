import { Suspense } from "react";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { ResetPasswordForm } from "@/components/feature/auth/ResetPasswordForm";

export default function ResetPasswordPage() {
    return (
        <Suspense>
            <AuthLayout
                title="Reset Password"
                subtitle="Choose a new password for your account."
            >
                <ResetPasswordForm />
            </AuthLayout>
        </Suspense>
    );
}