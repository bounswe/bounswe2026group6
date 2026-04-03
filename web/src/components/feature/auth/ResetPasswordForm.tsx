"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PasswordInput } from "@/components/ui/inputs/PasswordInput";
import { Divider } from "@/components/ui/display/Divider";
import { HelperText } from "@/components/ui/display/HelperText";
import { PrimaryButton } from "@/components/ui/buttons/PrimaryButton";
import { resetPassword } from "@/lib/auth";

export function ResetPasswordForm() {
    const searchParams = useSearchParams();
    const token = searchParams.get("token") || "";

    const [newPassword, setNewPassword] = React.useState("");
    const [confirmPassword, setConfirmPassword] = React.useState("");
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState("");
    const [info, setInfo] = React.useState("");
    const [success, setSuccess] = React.useState(false);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError("");
        setInfo("");

        if (!token.trim()) {
            setError("The password reset link is missing its token.");
            return;
        }

        if (!newPassword.trim() || !confirmPassword.trim()) {
            setError("Please fill in both password fields.");
            return;
        }

        if (newPassword.length < 8) {
            setError("Your new password must be at least 8 characters.");
            return;
        }

        if (newPassword !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        try {
            setLoading(true);
            const response = await resetPassword({
                token,
                newPassword,
            });
            setInfo(response.message);
            setSuccess(true);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Could not reset your password. Please try again."
            );
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="flex flex-col gap-4 text-center">
                <div className="rounded-[14px] border border-[color:var(--border-subtle)] bg-[color:var(--background-page)] p-5">
                    <h3 className="text-lg font-semibold text-[color:var(--text-primary)]">
                        Password updated
                    </h3>
                    <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
                        {info || "Your password was reset successfully. You can log in now."}
                    </p>
                </div>

                <Link
                    href="/login"
                    className="inline-flex h-11 w-full items-center justify-center rounded-[10px] bg-red-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-red-600 active:bg-red-700"
                >
                    Back to Log In
                </Link>
            </div>
        );
    }

    return (
        <>
            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
                <PasswordInput
                    id="reset-password-new"
                    label="New Password"
                    placeholder="Enter a new password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                />

                <PasswordInput
                    id="reset-password-confirm"
                    label="Confirm New Password"
                    placeholder="Confirm your new password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                />

                {error ? <HelperText className="text-red-500">{error}</HelperText> : null}
                {info ? <HelperText>{info}</HelperText> : null}

                <PrimaryButton type="submit" loading={loading}>
                    Reset Password
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
