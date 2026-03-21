    import { AuthLayout } from "@/components/layout/AuthLayout";
import { LoginForm } from "@/components/feature/auth/LoginForm";

export default function LoginPage() {
    return (
        <AuthLayout
            title="Log In"
            subtitle="Access your NEPH account to manage your emergency information."
        >
            <LoginForm />
        </AuthLayout>
    );
}