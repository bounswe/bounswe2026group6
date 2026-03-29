import { apiRequest } from "@/lib/api";

export const ACCESS_TOKEN_KEY = "neph_access_token";
export const SIGNUP_DRAFT_KEY = "neph_signup_draft";

export type AuthUser = {
    userId: string;
    email: string;
    isEmailVerified: boolean;
    acceptedTerms?: boolean;
    createdAt?: string;
    isAdmin?: boolean;
    adminRole?: string | null;
};

type SignupResponse = {
    message: string;
    user: AuthUser;
};

type LoginResponse = {
    message: string;
    accessToken: string;
    user: AuthUser;
};

type VerifyEmailResponse = {
    message: string;
    user: AuthUser;
};

type ResendVerificationResponse = {
    message: string;
};

type CurrentUserResponse = AuthUser;

type SetAccessTokenOptions = {
    rememberMe?: boolean;
};

function isBrowser() {
    return typeof window !== "undefined";
}

export function getAccessToken() {
    if (!isBrowser()) {
        return null;
    }

    return (
        window.localStorage.getItem(ACCESS_TOKEN_KEY) ||
        window.sessionStorage.getItem(ACCESS_TOKEN_KEY)
    );
}

export function setAccessToken(
    token: string,
    options: SetAccessTokenOptions = {}
) {
    if (!isBrowser()) {
        return;
    }

    const { rememberMe = true } = options;

    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);

    if (rememberMe) {
        window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
        return;
    }

    window.sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearAccessToken() {
    if (!isBrowser()) {
        return;
    }

    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
}

export async function signup(payload: {
    email: string;
    password: string;
    acceptedTerms: boolean;
}) {
    return apiRequest<SignupResponse>("/auth/signup", {
        method: "POST",
        body: {
            ...payload,
            email: payload.email.trim(),
        },
    });
}

export async function login(payload: { email: string; password: string }) {
    return apiRequest<LoginResponse>("/auth/login", {
        method: "POST",
        body: {
            ...payload,
            email: payload.email.trim(),
        },
    });
}

export async function verifyEmail(token: string) {
    const encodedToken = encodeURIComponent(token.trim());

    return apiRequest<VerifyEmailResponse>(`/auth/verify-email?token=${encodedToken}`);
}

export async function resendVerification(email: string) {
    return apiRequest<ResendVerificationResponse>("/auth/resend-verification", {
        method: "POST",
        body: { email: email.trim() },
    });
}

export async function fetchCurrentUser(token: string) {
    return apiRequest<CurrentUserResponse>("/auth/me", {
        token: token.trim(),
    });
}