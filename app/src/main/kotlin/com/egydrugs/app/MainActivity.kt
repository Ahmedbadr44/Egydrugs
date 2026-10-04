package com.egydrugs.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.egydrugs.app.ui.DetailScreen
import com.egydrugs.app.ui.EgyDrugsTheme
import com.egydrugs.app.ui.MainViewModel
import com.egydrugs.app.ui.SearchScreen

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            EgyDrugsTheme {
                AppRoot()
            }
        }
    }
}

@Composable
private fun AppRoot(vm: MainViewModel = viewModel()) {
    val search by vm.search.collectAsStateWithLifecycle()
    val detail by vm.detail.collectAsStateWithLifecycle()
    // Kept here so the results list keeps its scroll position while a detail screen is open.
    val listState = rememberLazyListState()

    val current = detail
    BackHandler(enabled = current != null) {
        vm.back()
    }

    if (current == null) {
        SearchScreen(
            state = search,
            listState = listState,
            onQueryChange = vm::setQuery,
            onScopeChange = vm::setScope,
            onOpen = vm::open
        )
    } else {
        DetailScreen(
            state = current,
            onBack = { vm.back() },
            onOpen = vm::open,
            onSameRoute = vm::setSameRoute,
            onSameStrength = vm::setSameStrength
        )
    }
}
