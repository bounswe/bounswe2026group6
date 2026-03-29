export class ApiError extends Error {
    code: string;
    status: number;

    constructor(message: string, options: { code?: string; status: number }) {
        super(message);
        this.name = "ApiError";
        this.code = options.code || "UNKNOWN_ERROR";
        this.status = options.status;

        Object.setPrototypeOf(this, ApiError.prototype);
    }
}

type ApiRequestOptions = Omit<RequestInit, "body"> & {
    token?: string | null;
    body?: BodyInit | Record<string, unknown> | unknown[] | null;
};

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "/api";

function normalizePath(path: string) {
    return path.startsWith("/") ? path : `/${path}`;
}

function buildHeaders(options: ApiRequestOptions): Headers {
    const headers = new Headers(options.headers);

    if (options.token) {
        headers.set("Authorization", `Bearer ${options.token}`);
    }

    const body = options.body;

    if (
        body != null &&
        !(body instanceof FormData) &&
        !(body instanceof URLSearchParams) &&
        typeof body !== "string" &&
        !headers.has("Content-Type")
    ) {
        headers.set("Content-Type", "application/json");
    }

    return headers;
}

function buildBody(body: ApiRequestOptions["body"]): BodyInit | undefined {
    if (body == null) {
        return undefined;
    }

    if (
        body instanceof FormData ||
        body instanceof URLSearchParams ||
        typeof body === "string"
    ) {
        return body;
    }

    return JSON.stringify(body);
}

function extractErrorCode(data: unknown) {
    if (data && typeof data === "object" && "code" in data) {
        const code = (data as { code?: unknown }).code;
        if (typeof code === "string" && code.trim()) {
            return code;
        }
    }

    return undefined;
}

function extractErrorMessage(data: unknown, fallback = "Request failed") {
    if (typeof data === "string" && data.trim()) {
        return data;
    }

    if (!data || typeof data !== "object") {
        return fallback;
    }

    const record = data as Record<string, unknown>;

    const directMessageKeys = ["message", "detail", "error"];

    for (const key of directMessageKeys) {
        const value = record[key];
        if (typeof value === "string" && value.trim()) {
            return value;
        }
    }

    if (record.errors && typeof record.errors === "object") {
        for (const value of Object.values(record.errors as Record<string, unknown>)) {
            if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim()) {
                return value[0];
            }

            if (typeof value === "string" && value.trim()) {
                return value;
            }
        }
    }

    for (const [key, value] of Object.entries(record)) {
        if (key === "code") {
            continue;
        }

        if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim()) {
            return value[0];
        }

        if (typeof value === "string" && value.trim()) {
            return value;
        }
    }

    return fallback;
}

export async function apiRequest<T>(
    path: string,
    options: ApiRequestOptions = {}
): Promise<T> {
    let response: Response;

    try {
        response = await fetch(`${API_BASE_URL}${normalizePath(path)}`, {
            ...options,
            headers: buildHeaders(options),
            body: buildBody(options.body),
        });
    } catch {
        throw new ApiError(
            "Could not reach the server. Please check your connection and try again.",
            {
                code: "NETWORK_ERROR",
                status: 0,
            }
        );
    }

    if (response.status === 204) {
        return undefined as T;
    }

    const text = await response.text();
    let data: unknown = null;

    if (text) {
        try {
            data = JSON.parse(text) as unknown;
        } catch {
            data = text;
        }
    }

    if (!response.ok) {
        throw new ApiError(extractErrorMessage(data), {
            code: extractErrorCode(data),
            status: response.status,
        });
    }

    return data as T;
}