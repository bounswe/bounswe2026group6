"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { TextInput } from "@/components/ui/inputs/TextInput";
import { PasswordInput } from "@/components/ui/inputs/PasswordInput";
import { Checkbox } from "@/components/ui/selection/Checkbox";
import { PrimaryButton } from "@/components/ui/buttons/PrimaryButton";
import { SecondaryButton } from "@/components/ui/buttons/SecondaryButton";
import { Divider } from "@/components/ui/display/Divider";
import { HelperText } from "@/components/ui/display/HelperText";
import { AuthFooterLinks } from "@/components/feature/auth/AuthFooterLinks";
import { SocialAuthButtons } from "@/components/feature/auth/SocialAuthButtons";
import { ApiError } from "@/lib/api";
import { login, setAccessToken } from "@/lib/auth";
import { fetchMyProfile } from "@/lib/profile";
import { isValidEmail } from "@/lib/validators/email";

export function LoginForm() {
    const router = useRouter();

    const [showEmailForm, setShowEmailForm] = React.useState(false);
    const [email, setEmail] = React.useState("");
    const [password, setPassword] = React.useState("");
    const [rememberMe, setRememberMe] = React.useState(false);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState("");
    const [info, setInfo] = React.useState("");

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError("");
        setInfo("");

        if (!email.trim() || !password.trim()) {
            setError("Please fill in both email and password.");
            return;
        }

        if (!isValidEmail(email)) {
            setError("Please enter a valid email address.");
            return;
        }

        try {
            setLoading(true);

            const response = await login({ email, password });

            try {
                await fetchMyProfile(response.accessToken);
                setAccessToken(response.accessToken, { rememberMe });
                router.push("/profile");
            } catch (profileError) {
                if (profileError instanceof ApiError && profileError.status === 404) {
                    setAccessToken(response.accessToken, { rememberMe });
                    router.push("/complete-profile");
                    return;
                }

                throw profileError;
            }
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Login failed. Please try again."
            );
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = () => {
        const target = email.trim()
            ? `/forgot-password?email=${encodeURIComponent(email)}`
            : "/forgot-password";

        router.push(target);
    };

    const handleSocialAuth = (provider: "Google" | "Facebook" | "Apple") => {
        setError("");
        setInfo(
            `${provider} sign-in UI is ready. Real OAuth login will be connected after provider credentials and backend callback setup are completed.`
        );
    };

    return (
        <>
            <SocialAuthButtons mode="login" onProviderClick={handleSocialAuth} />

            <div className="my-5 flex items-center gap-3">
                <Divider className="flex-1" />
                <span className="text-xs font-medium uppercase tracking-[0.14em] text-[#A3A3AD]">
                    or
                </span>
                <Divider className="flex-1" />
            </div>

            {!showEmailForm ? (
                <SecondaryButton
                    type="button"
                    onClick={() => {
                        setInfo("");
                        setError("");
                        setShowEmailForm(true);
                    }}
                >
                    Continue with Email
                </SecondaryButton>
            ) : (
                <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
                    <TextInput
                        id="login-email"
                        label="Email"
                        type="email"
                        placeholder="Enter your email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />

                    <PasswordInput
                        id="login-password"
                        label="Password"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />

                    <div className="flex items-center justify-between gap-4">
                        <Checkbox
                            id="remember-me"
                            label="Remember me"
                            checked={rememberMe}
                            onCheckedChange={setRememberMe}
                        />

                        <button
                            type="button"
                            onClick={handleForgotPassword}
                            className="text-sm font-medium text-[#D84A4A] hover:underline"
                        >
                            Forgot password?
                        </button>
                    </div>

                    {error ? (
                        <HelperText className="text-[#D84A4A]">
                            {error}
                        </HelperText>
                    ) : null}

                    {info ? <HelperText>{info}</HelperText> : null}

                    <PrimaryButton type="submit" loading={loading}>
                        Log In
                    </PrimaryButton>
                </form>
            )}

            {!showEmailForm && info ? (
                <div className="mt-4">
                    <HelperText>{info}</HelperText>
                </div>
            ) : null}

            <Divider className="my-6" />

            <AuthFooterLinks mode="login" />
        </>
    );
}