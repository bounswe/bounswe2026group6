import { apiRequest } from "@/lib/api";

export type ActiveHelpRequestStatus = "PENDING" | "ASSIGNED" | "IN_PROGRESS";
export type AssignmentState = "ASSIGNED" | "UNASSIGNED";

export type ActiveHelpRequestItem = {
    requestId: string;
    type: string;
    status: ActiveHelpRequestStatus;
    urgencyLevel: "LOW" | "MEDIUM" | "HIGH";
    createdAt: string;
    assignmentState: AssignmentState;
    location: {
        latitude: number | null;
        longitude: number | null;
        city: string;
        district: string;
        neighborhood?: string;
    };
};

type ActiveHelpRequestsResponse = {
    requests: ActiveHelpRequestItem[];
    total: number;
    pagination: {
        limit: number;
        offset: number;
    };
};

export async function fetchActiveHelpRequests(options: {
    token?: string | null;
    type?: string;
    status?: string;
    bbox?: string;
    limit?: number;
    offset?: number;
} = {}) {
    const params = new URLSearchParams();

    if (options.type?.trim()) {
        params.set("type", options.type.trim());
    }
    if (options.status?.trim()) {
        params.set("status", options.status.trim());
    }
    if (options.bbox?.trim()) {
        params.set("bbox", options.bbox.trim());
    }
    if (typeof options.limit === "number") {
        params.set("limit", String(options.limit));
    }
    if (typeof options.offset === "number") {
        params.set("offset", String(options.offset));
    }

    const query = params.toString() ? `?${params.toString()}` : "";
    return apiRequest<ActiveHelpRequestsResponse>(`/help-requests/active${query}`, {
        token: options.token || undefined,
    });
}

