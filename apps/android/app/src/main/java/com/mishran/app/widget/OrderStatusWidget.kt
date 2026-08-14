// apps/android/app/src/main/java/com/mishran/app/widget/OrderStatusWidget.kt — Task 11.2.
//
// Glance widget: renders the latest in-flight order's stage + ETA and deep
// links to its detail screen (mishran://order/{id}). Data comes straight
// from the Room order cache the hourly worker + pushes keep fresh; Glance
// pulls via an entry point because the system constructs the widget, not
// Hilt. Pushes (Task 11.3) and the hourly refresh call updateAll so the
// widget re-renders the moment state moves.
package com.mishran.app.widget

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.padding
import androidx.glance.semantics.contentDescription
import androidx.glance.semantics.semantics
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import com.mishran.app.data.local.dao.OrderDao
import com.mishran.app.data.repository.orderItemsAdapter
import com.mishran.app.data.repository.toDomain
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.flow.first

/** Hilt bridge for Glance — the system constructs widgets, not the graph. */
@EntryPoint
@InstallIn(SingletonComponent::class)
interface WidgetEntryPoint {
    fun orderDao(): OrderDao
    fun moshi(): com.squareup.moshi.Moshi
}

class OrderStatusWidget : GlanceAppWidget() {

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val entryPoint = EntryPointAccessors.fromApplication<WidgetEntryPoint>(context.applicationContext)
        val adapter = orderItemsAdapter(entryPoint.moshi())
        val orders = entryPoint.orderDao().observeAll().first()
            .map { row -> row.toDomain(adapter.fromJson(row.itemsJson) ?: emptyList()) }
        val tracked = latestTrackableOrder(orders)

        provideContent {
            if (tracked == null) {
                EmptyWidgetContent()
            } else {
                TrackedWidgetContent(
                    lines = widgetLines(tracked),
                    deepLink = "mishran://order/${tracked.id}",
                )
            }
        }
    }
}

@Composable
private fun TrackedWidgetContent(lines: WidgetLines, deepLink: String) {
    // The deep link lands on the ORDER_DETAIL NavGraph destination (Task 7.4).
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(deepLink))
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    Box(
        modifier = GlanceModifier
            .fillMaxSize()
            .background(BACKGROUND)
            .cornerRadius(16.dp)
            .padding(12.dp)
            .semantics { contentDescription = "Order ${lines.stage}. Open order details." }
            .clickable(actionStartActivity(intent)),
        contentAlignment = Alignment.Center,
    ) {
        Column {
            Text(
                text = lines.title,
                style = TextStyle(color = ColorProvider(TEXT_MUTED), fontSize = 12.sp),
            )
            Text(
                text = lines.stage,
                style = TextStyle(
                    color = ColorProvider(TEXT_MAIN),
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                ),
            )
            Text(
                text = lines.eta,
                style = TextStyle(color = ColorProvider(TEXT_MUTED), fontSize = 12.sp),
            )
        }
    }
}

@Composable
private fun EmptyWidgetContent() {
    // Inert by design: nothing to track, nothing to deep link to.
    Box(
        modifier = GlanceModifier
            .fillMaxSize()
            .background(BACKGROUND)
            .cornerRadius(16.dp)
            .padding(12.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = "No orders in progress",
            style = TextStyle(color = ColorProvider(TEXT_MUTED), fontSize = 12.sp),
        )
    }
}

// Brand palette (kakvi brown surface, cream + saffron text) — mirrors
// ui/theme/Color.kt values; Glance needs its own Color constants.
private val BACKGROUND = Color(0xFF3E1F10)
private val TEXT_MAIN = Color(0xFFFFF8F0)
private val TEXT_MUTED = Color(0xFFD79A35)
