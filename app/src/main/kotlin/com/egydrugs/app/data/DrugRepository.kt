package com.egydrugs.app.data

import android.content.Context
import com.egydrugs.app.core.CsvParser
import com.egydrugs.app.core.Drug
import com.egydrugs.app.core.DrugIndex
import com.egydrugs.app.core.IndexedDrug
import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.File

object DrugRepository {

    private const val ASSET_NAME = "egyptian-drugs.csv"
    // Increment when the bundled CSV or the cached index format changes.
    private const val CACHE_VERSION = 4
    private const val MAX_DRUGS = 100_000

    @Volatile
    private var cachedIndex: DrugIndex? = null

    fun savedRemoteVersion(context: Context): Long =
        context.getSharedPreferences("drug-sync", Context.MODE_PRIVATE).getLong("version", -1L)

    fun replaceWithRemote(context: Context, drugs: List<Drug>, version: Long): DrugIndex {
        val normalized = drugs.mapIndexed { id, drug -> drug.copy(id = id) }
        val index = DrugIndex(normalized)
        if (saveToCache(context.cacheDir, index)) {
            context.getSharedPreferences("drug-sync", Context.MODE_PRIVATE)
                .edit()
                .putLong("version", version)
                .apply()
        }
        cachedIndex = index
        return index
    }

    /** Reuses the in-memory index, then a precomputed private cache, before parsing the bundled CSV. */
    fun load(context: Context): DrugIndex = cachedIndex ?: synchronized(this) {
        (cachedIndex ?: loadFromCache(context.cacheDir)
            ?: buildFromAssets(context).also { saveToCache(context.cacheDir, it) }
        ).also { cachedIndex = it }
    }

    private fun loadFromCache(cacheDir: File): DrugIndex? {
        val file = File(cacheDir, "drug-index-v$CACHE_VERSION.bin")
        if (!file.isFile) return null

        return try {
            DataInputStream(BufferedInputStream(file.inputStream())).use { input ->
                require(input.readInt() == CACHE_VERSION)
                val count = input.readInt()
                require(count in 0..MAX_DRUGS)
                val items = ArrayList<IndexedDrug>(count)
                repeat(count) {
                    val drug = Drug(
                        id = input.readInt(),
                        nameEn = input.readUTF(),
                        nameAr = input.readUTF(),
                        scientific = input.readUTF(),
                        manufacturer = input.readUTF(),
                        drugClass = input.readUTF(),
                        route = input.readUTF(),
                        price = if (input.readBoolean()) input.readDouble() else null,
                        dosage = input.readUTF(),
                        productType = if (input.readBoolean()) input.readUTF() else null,
                        remoteId = if (input.readBoolean()) input.readLong() else null
                    )
                    items.add(
                        IndexedDrug(
                            drug = drug,
                            litEn = input.readUTF(),
                            litAr = input.readUTF(),
                            litSci = input.readUTF(),
                            pkEn = input.readUTF(),
                            pkSci = input.readUTF(),
                            skEn = input.readUTF(),
                            skAr = input.readUTF(),
                            skSci = input.readUTF(),
                            ingKey = input.readUTF(),
                            classPath = readStrings(input),
                            strength = readStrings(input)
                        )
                    )
                }
                require(input.read() == -1)
                DrugIndex.fromPrecomputed(items)
            }
        } catch (_: Exception) {
            file.delete()
            null
        }
    }

    private fun saveToCache(cacheDir: File, index: DrugIndex): Boolean {
        val file = File(cacheDir, "drug-index-v$CACHE_VERSION.bin")
        val temp = File(cacheDir, "drug-index-v$CACHE_VERSION.tmp")
        try {
            DataOutputStream(BufferedOutputStream(temp.outputStream())).use { output ->
                output.writeInt(CACHE_VERSION)
                output.writeInt(index.items.size)
                for (item in index.items) {
                    val drug = item.drug
                    output.writeInt(drug.id)
                    output.writeUTF(drug.nameEn)
                    output.writeUTF(drug.nameAr)
                    output.writeUTF(drug.scientific)
                    output.writeUTF(drug.manufacturer)
                    output.writeUTF(drug.drugClass)
                    output.writeUTF(drug.route)
                    output.writeBoolean(drug.price != null)
                    drug.price?.let(output::writeDouble)
                    output.writeUTF(drug.dosage)
                    output.writeBoolean(drug.productType != null)
                    drug.productType?.let(output::writeUTF)
                    output.writeBoolean(drug.remoteId != null)
                    drug.remoteId?.let(output::writeLong)
                    output.writeUTF(item.litEn)
                    output.writeUTF(item.litAr)
                    output.writeUTF(item.litSci)
                    output.writeUTF(item.pkEn)
                    output.writeUTF(item.pkSci)
                    output.writeUTF(item.skEn)
                    output.writeUTF(item.skAr)
                    output.writeUTF(item.skSci)
                    output.writeUTF(item.ingKey)
                    writeStrings(output, item.classPath)
                    writeStrings(output, item.strength)
                }
            }
            if (file.exists()) file.delete()
            if (temp.renameTo(file)) return true
            temp.delete()
            return false
        } catch (_: Exception) {
            temp.delete()
            return false
        }
    }

    private fun readStrings(input: DataInputStream): List<String> {
        val count = input.readInt()
        require(count in 0..64)
        return List(count) { input.readUTF() }
    }

    private fun writeStrings(output: DataOutputStream, values: List<String>) {
        output.writeInt(values.size)
        values.forEach(output::writeUTF)
    }

    private fun buildFromAssets(context: Context): DrugIndex {
        val text = context.assets.open(ASSET_NAME).bufferedReader(Charsets.UTF_8).use { it.readText() }
        val drugs = CsvParser.toDrugs(CsvParser.parse(text))
        return DrugIndex(drugs)
    }
}
