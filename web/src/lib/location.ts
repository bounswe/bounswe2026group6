import { apiRequest } from "@/lib/api";
import {
    LocationReverseResponse,
    LocationSearchResponse,
    LocationTreeResponse,
} from "@/types/location";

function buildQuery(params: Record<string, string | number | undefined>) {
    const searchParams = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === "") {
            continue;
        }

        searchParams.set(key, String(value));
    }

    const serialized = searchParams.toString();
    return serialized ? `?${serialized}` : "";
}

export async function fetchLocationTree(countryCode = "TR") {
    const query = buildQuery({ countryCode });
    return apiRequest<LocationTreeResponse>(`/location/tree${query}`);
}

export async function searchLocations(params: {
    q: string;
    countryCode?: string;
    limit?: number;
}) {
    const query = buildQuery({
        q: params.q,
        countryCode: params.countryCode || "TR",
        limit: params.limit ?? 10,
    });

    return apiRequest<LocationSearchResponse>(`/location/search${query}`);
}

export async function reverseLocation(params: { latitude: number; longitude: number }) {
    const query = buildQuery({
        lat: params.latitude,
        lon: params.longitude,
    });

    return apiRequest<LocationReverseResponse>(`/location/reverse${query}`);
}
