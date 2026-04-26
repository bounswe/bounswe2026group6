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

export type EmergencyOperationalItem = {
    requestId: string;
    needType: string | null;
    status: "PENDING" | "ASSIGNED" | "IN_PROGRESS" | "RESOLVED" | "CANCELLED";
    urgencyLevel: "LOW" | "MEDIUM" | "HIGH";
    priorityLevel: "LOW" | "MEDIUM" | "HIGH";
    openedAt: string;
    openDurationMinutes: number;
    closedAt: string | null;
    closedState: "RESOLVED" | "CANCELLED" | null;
    location: {
        city: string;
        district: string;
    };
};

export type EmergencyOverview = {
    totals: EmergencyOverviewTotals;
    statusBreakdown: EmergencyOverviewStatusBreakdown;
    urgencyBreakdown: EmergencyOverviewUrgencyBreakdown;
    recentActivity: EmergencyOverviewRecentActivity;
    activeOperational: EmergencyOperationalItem[];
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
    openedAt: string;
    openDurationMinutes: number;
    closedState: "RESOLVED" | "CANCELLED" | null;
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
    priorityLevel: "LOW" | "MEDIUM" | "HIGH";
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

export type EmergencyAnalyticsRegionItem = {
    city: string;
    total: number;
    active: number;
    pending: number;
    inProgress: number;
    resolved: number;
    cancelled: number;
};

export type EmergencyAnalyticsTypeItem = {
    needType: string;
    total: number;
    active: number;
    resolved: number;
    cancelled: number;
    percentage: number;
};

export type EmergencyAnalyticsTrendItem = {
    date: string;
    created: number;
    resolved: number;
    cancelled: number;
};

export type EmergencyAnalyticsComparisonMetric = {
    current: number;
    previous: number;
    delta: number;
    percentChange: number | null;
};

export type EmergencyAnalyticsPeriodComparison = {
    windowDays: number;
    created: EmergencyAnalyticsComparisonMetric;
    resolved: EmergencyAnalyticsComparisonMetric;
    cancelled: EmergencyAnalyticsComparisonMetric;
};

export type EmergencyAnalytics = {
    regionBreakdown: EmergencyAnalyticsRegionItem[];
    typeBreakdown: EmergencyAnalyticsTypeItem[];
    dailyTrend: EmergencyAnalyticsTrendItem[];
    periodComparison: EmergencyAnalyticsPeriodComparison;
};

type EmergencyAnalyticsResponse = {
    analytics: EmergencyAnalytics;
};

export async function fetchAdminEmergencyAnalytics(
    token: string,
    options: {
        regionLimit?: number;
        trendDays?: number;
        comparisonWindowDays?: number;
    } = {}
) {
    const params = new URLSearchParams();
    if (typeof options.regionLimit === "number") {
        params.set("regionLimit", String(options.regionLimit));
    }
    if (typeof options.trendDays === "number") {
        params.set("trendDays", String(options.trendDays));
    }
    if (typeof options.comparisonWindowDays === "number") {
        params.set("comparisonWindowDays", String(options.comparisonWindowDays));
    }

    const query = params.toString() ? `?${params.toString()}` : "";
    const response = await apiRequest<EmergencyAnalyticsResponse>(
        `/admin/emergency-analytics${query}`,
        {
            token: token.trim(),
        }
    );

    return response.analytics;
}

export type DeploymentMonitoringStatus =
    | "PENDING"
    | "ASSIGNED"
    | "IN_PROGRESS"
    | "RESOLVED"
    | "CANCELLED";

export type DeploymentMonitoringItem = {
    requestId: string;
    needType: string | null;
    status: DeploymentMonitoringStatus;
    urgencyLevel: "LOW" | "MEDIUM" | "HIGH";
    priorityLevel: "LOW" | "MEDIUM" | "HIGH";
    createdAt: string;
    ageHours: number;
    assignedAt: string | null;
    assignedHoursAgo: number | null;
    volunteerId: string | null;
    location: {
        city: string;
        district: string;
    };
};

export type DeploymentMonitoringConflictGroup = {
    groupKey: {
        city: string;
        needType: string;
        contactKey: string;
    };
    duplicateCount: number;
    items: DeploymentMonitoringItem[];
};

export type DeploymentMonitoringSummary = {
    unassigned: number;
    longWaiting: number;
    inProgress: number;
    neglected: number;
    conflicts: number;
};

export type DeploymentMonitoringThresholds = {
    waitThresholdHours: number;
    neglectThresholdHours: number;
    listLimit: number;
};

export type DeploymentMonitoring = {
    thresholds: DeploymentMonitoringThresholds;
    summary: DeploymentMonitoringSummary;
    unassigned: DeploymentMonitoringItem[];
    longWaiting: DeploymentMonitoringItem[];
    inProgress: DeploymentMonitoringItem[];
    neglected: DeploymentMonitoringItem[];
    conflicts: DeploymentMonitoringConflictGroup[];
};

type DeploymentMonitoringResponse = {
    monitoring: DeploymentMonitoring;
};

export async function fetchAdminDeploymentMonitoring(
    token: string,
    options: {
        waitThresholdHours?: number;
        neglectThresholdHours?: number;
        listLimit?: number;
    } = {}
) {
    const params = new URLSearchParams();
    if (typeof options.waitThresholdHours === "number") {
        params.set("waitThresholdHours", String(options.waitThresholdHours));
    }
    if (typeof options.neglectThresholdHours === "number") {
        params.set("neglectThresholdHours", String(options.neglectThresholdHours));
    }
    if (typeof options.listLimit === "number") {
        params.set("listLimit", String(options.listLimit));
    }

    const query = params.toString() ? `?${params.toString()}` : "";
    const response = await apiRequest<DeploymentMonitoringResponse>(
        `/admin/deployment-monitoring${query}`,
        {
            token: token.trim(),
        }
    );

    return response.monitoring;
}
