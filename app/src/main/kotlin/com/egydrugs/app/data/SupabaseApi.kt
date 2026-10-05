package com.egydrugs.app.data

import com.egydrugs.app.BuildConfig
import com.egydrugs.app.core.Drug
import com.egydrugs.app.core.DrugMedicalInfo
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

object SupabaseApi {
    private const val PAGE_SIZE = 1000
    private const val CONNECT_TIMEOUT_MS = 15_000
    private const val READ_TIMEOUT_MS = 30_000

    private val baseUrl get() = BuildConfig.SUPABASE_URL.trimEnd('/')
    private val apiKey get() = BuildConfig.SUPABASE_PUBLISHABLE_KEY

    val isConfigured: Boolean
        get() = baseUrl.isNotBlank() && apiKey.isNotBlank()

    fun getDataVersion(): Long {
        val result = JSONArray(request("GET", "/rest/v1/drug_data_version?select=version&id=eq.1&limit=1"))
        require(result.length() == 1) { "Missing drug data version row" }
        return result.getJSONObject(0).getLong("version")
    }

    fun fetchDrugs(): List<Drug> {
        val result = ArrayList<Drug>()
        var offset = 0
        while (true) {
            val end = offset + PAGE_SIZE - 1
            val page = JSONArray(
                request(
                    "GET",
                    "/rest/v1/drugs?select=id,commercial_name_en,commercial_name_ar,scientific_name,manufacturer,drug_class,route,price_egp,dosage,product_type&order=id.asc",
                    headers = mapOf("Range-Unit" to "items", "Range" to "$offset-$end")
                )
            )
            for (i in 0 until page.length()) {
                val row = page.getJSONObject(i)
                result.add(
                    Drug(
                        id = result.size,
                        nameEn = row.optString("commercial_name_en"),
                        nameAr = row.optString("commercial_name_ar"),
                        scientific = row.optString("scientific_name"),
                        manufacturer = row.optString("manufacturer"),
                        drugClass = row.optString("drug_class"),
                        route = row.optString("route"),
                        price = row.optNullableDouble("price_egp"),
                        dosage = row.optString("dosage"),
                        remoteId = row.getLong("id")
                    )
                )
            }
            if (page.length() < PAGE_SIZE) break
            offset += PAGE_SIZE
        }
        return result
    }

    fun fetchDrugMedicalInfo(remoteId: Long): DrugMedicalInfo? {
        val result = JSONArray(
            request(
                "GET",
                "/rest/v1/drug_medical_effective?select=drug_id,uses,dosage,side_effects,contraindications,source_url,source_name,updated_at&drug_id=eq.$remoteId&limit=1"
            )
        )
        if (result.length() == 0) return null
        val row = result.getJSONObject(0)
        val uses = row.optJsonStrings("uses")
        val dosage = row.optJsonStrings("dosage")
        val sideEffects = row.optJsonStrings("side_effects")
        val contraindications = row.optJsonStrings("contraindications")
        if (uses.isEmpty() && dosage.isEmpty() && sideEffects.isEmpty() && contraindications.isEmpty()) return null
        return DrugMedicalInfo(
            uses = uses,
            dosage = dosage,
            sideEffects = sideEffects,
            contraindications = contraindications,
            sourceUrl = row.optNullableString("source_url"),
            sourceName = row.optNullableString("source_name"),
            updatedAt = row.optNullableString("updated_at")
        )
    }

    private fun request(
        method: String,
        path: String,
        headers: Map<String, String> = emptyMap()
    ): String {
        check(isConfigured) { "Supabase project settings are missing" }
        val connection = URL("$baseUrl$path").openConnection() as HttpURLConnection
        try {
            connection.requestMethod = method
            connection.connectTimeout = CONNECT_TIMEOUT_MS
            connection.readTimeout = READ_TIMEOUT_MS
            connection.setRequestProperty("apikey", apiKey)
            connection.setRequestProperty("Accept", "application/json")
            headers.forEach { (name, value) -> connection.setRequestProperty(name, value) }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val response = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            if (status !in 200..299) {
                val message = runCatching {
                    JSONObject(response).let { it.optString("message").ifBlank { it.optString("msg") } }
                }.getOrNull()
                error(message?.takeIf(String::isNotBlank) ?: "Supabase request failed ($status)")
            }
            return response
        } finally {
            connection.disconnect()
        }
    }

    private fun JSONObject.optNullableDouble(name: String): Double? =
        if (isNull(name)) null else optDouble(name).takeIf { it.isFinite() }

    private fun JSONObject.optNullableString(name: String): String? =
        if (isNull(name)) null else optString(name).takeIf { it.isNotBlank() }

    private fun JSONObject.optJsonStrings(name: String): List<String> {
        val value = optJSONArray(name) ?: return emptyList()
        return buildList(value.length()) {
            for (i in 0 until value.length()) {
                when (val item = value.opt(i)) {
                    is String -> item.trim().takeIf { it.isNotBlank() }?.let(::add)
                    is JSONObject -> item.optString("text").trim().takeIf { it.isNotBlank() }?.let(::add)
                }
            }
        }
    }
}
