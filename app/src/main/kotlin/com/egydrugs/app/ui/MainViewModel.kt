package com.egydrugs.app.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.egydrugs.app.core.Drug
import com.egydrugs.app.core.DrugIndex
import com.egydrugs.app.core.SearchScope
import com.egydrugs.app.data.DrugRepository
import com.egydrugs.app.data.SupabaseApi
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

class MainViewModel(app: Application) : AndroidViewModel(app) {

    // Forces one remote refresh after an app update, even if an older local cache
    // accidentally stored the same database version. After that, normal version checks apply.
    private val syncProtocolVersion = 2

    data class SearchUi(
        val loading: Boolean = true,
        val error: String? = null,
        val query: String = "",
        val scope: SearchScope = SearchScope.ALL,
        val results: List<Drug> = emptyList(),
        val tooShort: Boolean = false
    )

    data class DetailUi(
        val drug: Drug,
        val equivalents: List<Drug>,
        val sameRoute: Boolean,
        val sameStrength: Boolean,
        val hasRoute: Boolean,
        val hasStrength: Boolean
    )

    private val _search = MutableStateFlow(SearchUi())
    val search: StateFlow<SearchUi> = _search.asStateFlow()

    private val _detail = MutableStateFlow<DetailUi?>(null)
    val detail: StateFlow<DetailUi?> = _detail.asStateFlow()

    private var index: DrugIndex? = null
    private var searchJob: Job? = null
    private var detailJob: Job? = null
    private val syncMutex = Mutex()

    /** Drugs opened one after another from the detail screen, so Back walks the path in reverse. */
    private val stack = ArrayList<Int>()
    private var sameRoute = true
    private var sameStrength = true

    init {
        viewModelScope.launch(Dispatchers.Default) {
            try {
                val loaded = DrugRepository.load(getApplication<Application>())
                index = loaded
                _search.update { it.copy(loading = false) }
                runSearch(immediate = true)
                refreshRemoteData()
                while (isActive) {
                    delay(60_000)
                    refreshRemoteData()
                }
            } catch (e: Exception) {
                if (e is CancellationException) throw e
                _search.update { it.copy(loading = false, error = e.message ?: "Error") }
            }
        }
    }

    fun setQuery(query: String) {
        _search.update { it.copy(query = query) }
        runSearch(immediate = false)
    }

    fun setScope(scope: SearchScope) {
        _search.update { it.copy(scope = scope) }
        runSearch(immediate = true)
    }

    private fun runSearch(immediate: Boolean) {
        val idx = index ?: return
        searchJob?.cancel()
        searchJob = viewModelScope.launch(Dispatchers.Default) {
            if (!immediate) delay(120)
            val state = _search.value
            val results = idx.search(state.query, state.scope)
            val trimmed = state.query.trim()
            _search.update {
                // Ignore the result if the user kept typing in the meantime.
                if (it.query == state.query && it.scope == state.scope) {
                    it.copy(results = results, tooShort = trimmed.isNotEmpty() && results.isEmpty() && trimmed.length < 2)
                } else {
                    it
                }
            }
        }
    }

    private suspend fun refreshRemoteData() {
        if (!SupabaseApi.isConfigured) return
        syncMutex.withLock {
            try {
                val app = getApplication<Application>()
                val version = withContext(Dispatchers.IO) { SupabaseApi.getDataVersion() }
                val prefs = app.getSharedPreferences("drug-sync", Application.MODE_PRIVATE)
                val protocolSeen = prefs.getInt("sync_protocol", 0)
                val forceRefresh = protocolSeen < syncProtocolVersion
                if (!forceRefresh && version <= DrugRepository.savedRemoteVersion(app)) return
                val drugs = withContext(Dispatchers.IO) { SupabaseApi.fetchDrugs() }
                if (drugs.isEmpty() && DrugRepository.savedRemoteVersion(app) < 0) return

                val previous = index
                val updated = DrugRepository.replaceWithRemote(app, drugs, version)
                prefs.edit().putInt("sync_protocol", syncProtocolVersion).apply()
                if (stack.isNotEmpty()) {
                    val oldDrugs = stack.mapNotNull { previous?.items?.getOrNull(it)?.drug }
                    val idByRemote = updated.items.mapNotNull { item ->
                        item.drug.remoteId?.let { it to item.drug.id }
                    }.toMap()
                    val idByName = updated.items.associate { it.drug.nameEn.lowercase() to it.drug.id }
                    val remapped = oldDrugs.map { old ->
                        old.remoteId?.let(idByRemote::get) ?: idByName[old.nameEn.lowercase()]
                    }
                    stack.clear()
                    if (remapped.size == oldDrugs.size && remapped.all { it != null }) {
                        stack.addAll(remapped.filterNotNull())
                    } else {
                        _detail.value = null
                    }
                }
                index = updated
                runSearch(immediate = true)
                if (stack.isNotEmpty()) refreshDetail()
            } catch (_: Exception) {
                // Keep using the last local snapshot when the network is unavailable.
            }
        }
    }

    // ---- details ---------------------------------------------------------------------------------

    fun open(drug: Drug) {
        if (stack.isEmpty()) {
            sameRoute = true
            sameStrength = true
        }
        stack.add(drug.id)
        refreshDetail()
    }

    /** Returns true when the back press was handled (i.e. a detail screen was open). */
    fun back(): Boolean {
        if (stack.isEmpty()) return false
        stack.removeAt(stack.size - 1)
        if (stack.isEmpty()) {
            detailJob?.cancel()
            _detail.value = null
        } else {
            refreshDetail()
        }
        return true
    }

    fun setSameRoute(value: Boolean) {
        sameRoute = value
        refreshDetail()
    }

    fun setSameStrength(value: Boolean) {
        sameStrength = value
        refreshDetail()
    }

    private fun refreshDetail() {
        val idx = index ?: return
        val id = stack.lastOrNull() ?: return
        val route = sameRoute
        val strength = sameStrength
        detailJob?.cancel()
        detailJob = viewModelScope.launch(Dispatchers.Default) {
            val ui = DetailUi(
                drug = idx.drug(id),
                equivalents = idx.equivalents(id, route, strength),
                sameRoute = route,
                sameStrength = strength,
                hasRoute = idx.hasKnownRoute(id),
                hasStrength = idx.hasStrength(id)
            )
            _detail.value = ui
        }
    }
}
