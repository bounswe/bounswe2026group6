import { apiRequest } from "@/lib/api";

export type ProvinceOption = {
    code: string;
    id: string;
    name: string;
};

export type DistrictOption = {
    id: string;
    provinceCode: string;
    name: string;
};

export type NeighborhoodOption = {
    id: string;
    provinceCode: string;
    districtId: string;
    name: string;
};

type ProvincesResponse = {
    provinces: ProvinceOption[];
};

type DistrictsResponse = {
    province: ProvinceOption;
    districts: DistrictOption[];
};

type NeighborhoodsResponse = {
    province: ProvinceOption;
    district: DistrictOption;
    neighborhoods: NeighborhoodOption[];
};

export async function fetchProvinces() {
    const response = await apiRequest<ProvincesResponse>("/locations/provinces");
    return response.provinces;
}

export async function fetchDistricts(provinceCode: string) {
    const response = await apiRequest<DistrictsResponse>(
        `/locations/districts?provinceCode=${encodeURIComponent(provinceCode)}`
    );
    return response.districts;
}

export async function fetchNeighborhoods(provinceCode: string, districtId: string) {
    const response = await apiRequest<NeighborhoodsResponse>(
        `/locations/neighborhoods?provinceCode=${encodeURIComponent(provinceCode)}&districtId=${encodeURIComponent(districtId)}`
    );
    return response.neighborhoods;
}
