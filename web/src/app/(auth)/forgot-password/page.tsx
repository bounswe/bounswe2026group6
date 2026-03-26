import { AuthLayout } from "@/components/layout/AuthLayout";
import { ForgotPasswordForm } from "@/components/feature/auth/ForgotPasswordForm";

export default function ForgotPasswordPage() {
    return (
        <AuthLayout
            title="Forgot Password"
            subtitle="Enter your email address and we will send you a reset link."
        >
            <ForgotPasswordForm />
        </AuthLayout>
    );
}