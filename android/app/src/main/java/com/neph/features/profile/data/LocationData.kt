package com.neph.features.profile.data

data class Neighborhood(val label: String, val value: String)
data class District(val label: String, val neighborhoods: List<Neighborhood>)
data class City(val label: String, val districts: Map<String, District>)
data class Country(val label: String, val cities: Map<String, City>)
typealias LocationData = Map<String, Country>


val locationData: LocationData = mapOf(
    "tr" to Country(
        label = "Turkey",
        cities = mapOf(
            "istanbul" to City(
                label = "Istanbul",
                districts = mapOf(
                    "kadikoy" to District(
                        label = "Kadıköy",
                        neighborhoods = listOf(
                            Neighborhood("Bostancı", "bostanci"),
                            Neighborhood("Erenköy", "erenkoy")
                        )
                    ),
                    "besiktas" to District(
                        label = "Beşiktaş",
                        neighborhoods = listOf(
                            Neighborhood("Balmumcu", "balmumcu"),
                            Neighborhood("Kuruçeşme", "kurucesme")
                        )
                    )
                )
            ),
            "ankara" to City(
                label = "Ankara",
                districts = mapOf(
                    "cankaya" to District(
                        label = "Çankaya",
                        neighborhoods = listOf(Neighborhood("Anıttepe", "anittepe"))
                    )
                )
            )
        )
    )
)
