import { apiRequest } from "@/lib/api";

export type EmergencyOverviewTotals = {
    totalEmergencies: number;
    activeEmergencies: number;
    resolvedEmergencies: number;
    closedEmergencies: number;
};

export type EmergencyOverviewStatusBreakdown = {
    pending: number;
    inProgress: number;
    resolved: number;
    cancelled: number;
};

export type EmergencyOverviewUrgencyBreakdown = {
    low: number;
    medium: number;
    high: number;
};

export type EmergencyOverviewRecentActivity = {
    createdLast24Hours: number;
    createdLast7Days: number;
    resolvedLast24Hours: number;
    resolvedLast7Days: number;
    cancelledLast24Hours: number;
    cancelledLast7Days: number;
};

export type EmergencyOverviewRegionItem = {
    city: string;
    total: number;
    active: number;
    pending: number;
    inProgress: number;
    resolved: number;
    cancelled: number;
};

export type EmergencyOverview = {
    totals: EmergencyOverviewTotals;
    statusBreakdown: EmergencyOverviewStatusBreakdown;
    urgencyBreakdown: EmergencyOverviewUrgencyBreakdown;
    recentActivity: EmergencyOverviewRecentActivity;
    regionSummary?: EmergencyOverviewRegionItem[];
};

type EmergencyOverviewResponse = {
    overview: EmergencyOverview;
};

export type EmergencyHistoryItem = {
    requestId: string;
    needType: string | null;
    description: string;
    status: "RESOLVED" | "CANCELLED";
    createdAt: string;
    resolvedAt: string | null;
    cancelledAt: string | null;
    closedAt: string;
    location: {
        country: string;
        city: string;
        district: string;
    };
    affectedPeopleCount: number;
    urgencyLevel: "LOW" | "MEDIUM" | "HIGH";
    riskFlags: string[];
};

export type EmergencyHistoryResponse = {
    history: EmergencyHistoryItem[];
    total: number;
    filters: {
        status: string[];
        city: string[];
        type: string[];
        limit: number;
        offset: number;
    };
};

export async function fetchAdminEmergencyOverview(
    token: string,
    options: { includeRegionSummary?: boolean } = {}
) {
    const query = options.includeRegionSummary ? "?includeRegionSummary=true" : "";
    const response = await apiRequest<EmergencyOverviewResponse>(
        `/admin/emergency-overview${query}`,
        {
            token: token.trim(),
        }
    );

    return response.overview;
}

export async function fetchAdminEmergencyHistory(
    token: string,
    options: {
        status?: string;
        city?: string;
        type?: string;
        urgency?: string;
        limit?: number;
        offset?: number;
    } = {}
) {
    const params = new URLSearchParams();
    if (options.status && options.status.trim()) {
        params.set("status", options.status.trim());
    }
    if (options.city && options.city.trim()) {
        params.set("city", options.city.trim());
    }
    if (options.type && options.type.trim()) {
        params.set("type", options.type.trim());
    }
    if (options.urgency && options.urgency.trim()) {
        params.set("urgency", options.urgency.trim());
    }
    if (typeof options.limit === "number") {
        params.set("limit", String(options.limit));
    }
    if (typeof options.offset === "number") {
        params.set("offset", String(options.offset));
    }

    const query = params.toString() ? `?${params.toString()}` : "";
    return apiRequest<EmergencyHistoryResponse>(`/admin/emergency-history${query}`, {
        token: token.trim(),
    });
}
