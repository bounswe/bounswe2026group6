import { apiRequest } from "@/lib/api";
import { NearbyGatheringAreasResponse } from "@/types/location";

type NearbyGatheringAreasQuery = {
    latitude: number;
    longitude: number;
    radius?: number;
    limit?: number;
};

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

export async function fetchNearbyGatheringAreas(
    params: NearbyGatheringAreasQuery
) {
    const query = buildQuery({
        lat: params.latitude,
        lon: params.longitude,
        radius: params.radius,
        limit: params.limit,
    });

    return apiRequest<NearbyGatheringAreasResponse>(
        `/gathering-areas/nearby${query}`
    );
}
