"use client";

import * as React from "react";
import {
    DistrictOption,
    NeighborhoodOption,
    ProvinceOption,
    fetchDistricts,
    fetchNeighborhoods,
    fetchProvinces,
} from "@/lib/locations";

type UseTurkishLocationsArgs = {
    provinceCode: string;
    districtId: string;
};

export function useTurkishLocations({ provinceCode, districtId }: UseTurkishLocationsArgs) {
    const [provinces, setProvinces] = React.useState<ProvinceOption[]>([]);
    const [districts, setDistricts] = React.useState<DistrictOption[]>([]);
    const [neighborhoods, setNeighborhoods] = React.useState<NeighborhoodOption[]>([]);
    const [loadingProvinces, setLoadingProvinces] = React.useState(true);
    const [loadingDistricts, setLoadingDistricts] = React.useState(false);
    const [loadingNeighborhoods, setLoadingNeighborhoods] = React.useState(false);
    const [provinceError, setProvinceError] = React.useState("");
    const [districtError, setDistrictError] = React.useState("");
    const [neighborhoodError, setNeighborhoodError] = React.useState("");

    const loadProvinces = React.useCallback(async () => {
        try {
            setLoadingProvinces(true);
            setProvinceError("");
            setProvinces(await fetchProvinces());
        } catch (error) {
            setProvinceError(
                error instanceof Error ? error.message : "Could not load provinces."
            );
            setProvinces([]);
        } finally {
            setLoadingProvinces(false);
        }
    }, []);

    const loadDistricts = React.useCallback(async (nextProvinceCode: string) => {
        if (!nextProvinceCode) {
            setDistricts([]);
            setDistrictError("");
            return;
        }

        try {
            setLoadingDistricts(true);
            setDistrictError("");
            setDistricts(await fetchDistricts(nextProvinceCode));
        } catch (error) {
            setDistrictError(
                error instanceof Error ? error.message : "Could not load districts."
            );
            setDistricts([]);
        } finally {
            setLoadingDistricts(false);
        }
    }, []);

    const loadNeighborhoods = React.useCallback(
        async (nextProvinceCode: string, nextDistrictId: string) => {
            if (!nextProvinceCode || !nextDistrictId) {
                setNeighborhoods([]);
                setNeighborhoodError("");
                return;
            }

            try {
                setLoadingNeighborhoods(true);
                setNeighborhoodError("");
                setNeighborhoods(await fetchNeighborhoods(nextProvinceCode, nextDistrictId));
            } catch (error) {
                setNeighborhoodError(
                    error instanceof Error
                        ? error.message
                        : "Could not load neighborhoods."
                );
                setNeighborhoods([]);
            } finally {
                setLoadingNeighborhoods(false);
            }
        },
        []
    );

    React.useEffect(() => {
        void loadProvinces();
    }, [loadProvinces]);

    React.useEffect(() => {
        void loadDistricts(provinceCode);
    }, [loadDistricts, provinceCode]);

    React.useEffect(() => {
        void loadNeighborhoods(provinceCode, districtId);
    }, [districtId, loadNeighborhoods, provinceCode]);

    return {
        provinces,
        districts,
        neighborhoods,
        loadingProvinces,
        loadingDistricts,
        loadingNeighborhoods,
        provinceError,
        districtError,
        neighborhoodError,
        retryProvinces: loadProvinces,
        retryDistricts: () => loadDistricts(provinceCode),
        retryNeighborhoods: () => loadNeighborhoods(provinceCode, districtId),
    };
}
