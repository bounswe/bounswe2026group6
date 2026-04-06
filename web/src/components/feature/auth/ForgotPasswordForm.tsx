"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { TextInput } from "@/components/ui/inputs/TextInput";
import { PrimaryButton } from "@/components/ui/buttons/PrimaryButton";
import { SecondaryButton } from "@/components/ui/buttons/SecondaryButton";
import { Divider } from "@/components/ui/display/Divider";
import { HelperText } from "@/components/ui/display/HelperText";
import { forgotPassword } from "@/lib/auth";
import { isValidEmail } from "@/lib/validators/email";

export function ForgotPasswordForm() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const initialEmail = searchParams.get("email") || "";

    const [email, setEmail] = React.useState(initialEmail);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState("");
    const [info, setInfo] = React.useState("");
    const [success, setSuccess] = React.useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError("");
        setInfo("");
        setSuccess(false);

        const trimmedEmail = email.trim();

        if (!trimmedEmail) {
            setError("Please enter your email address.");
            return;
        }

        if (!isValidEmail(trimmedEmail)) {
            setError("Please enter a valid email address.");
            return;
        }

        try {
            setLoading(true);
            const response = await forgotPassword(trimmedEmail);
            setInfo(response.message);
            setSuccess(true);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "We could not start the password reset flow. Please try again."
            );
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <>
                <div className="rounded-[14px] border border-[color:var(--border-subtle)] bg-[color:var(--background-page)] p-5 text-center">
                    <h3 className="text-lg font-semibold text-[color:var(--text-primary)]">
                        Reset email sent
                    </h3>

                    <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
                        If an account exists for <span className="font-medium">{email}</span>,
                        a password reset link will be sent.
                    </p>

                    {info ? <HelperText className="mt-4">{info}</HelperText> : null}

                    <div className="mt-5 flex flex-col gap-3">
                        <PrimaryButton onClick={() => router.push("/login")}>
                            Back to Log In
                        </PrimaryButton>

                        <SecondaryButton
                            type="button"
                            onClick={() => {
                                setSuccess(false);
                                setInfo("You can try again with another email address.");
                            }}
                        >
                            Use Another Email
                        </SecondaryButton>
                    </div>
                </div>

                <Divider className="my-6" />

                <div className="text-center">
                    <HelperText className="leading-6">
                        Remembered your password?{" "}
                        <Link
                            href="/login"
                            className="font-semibold text-[color:var(--primary-500)] hover:underline"
                        >
                            Go back to log in
                        </Link>
                    </HelperText>
                </div>
            </>
        );
    }

    return (
        <>
            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
                <TextInput
                    id="forgot-password-email"
                    label="Email"
                    type="email"
                    placeholder="Enter your email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />

                {error ? (
                    <HelperText className="text-[color:var(--primary-500)]">{error}</HelperText>
                ) : null}

                {info ? <HelperText>{info}</HelperText> : null}

                <PrimaryButton type="submit" loading={loading}>
                    Send Reset Link
                </PrimaryButton>
            </form>

            <Divider className="my-6" />

            <div className="text-center">
                <HelperText className="leading-6">
                    Remembered your password?{" "}
                    <Link
                        href="/login"
                        className="font-semibold text-[color:var(--primary-500)] hover:underline"
                    >
                        Go back to log in
                    </Link>
                </HelperText>
            </div>
        </>
    );
}
