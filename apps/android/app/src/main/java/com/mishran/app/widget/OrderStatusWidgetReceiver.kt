// apps/android/app/src/main/java/com/mishran/app/widget/OrderStatusWidgetReceiver.kt — Task 11.2.
//
// AppWidget broadcast receiver: forwards lifecycle events to the Glance
// widget and is the manifest-declared entry point for the home-screen pin.
package com.mishran.app.widget

import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver

class OrderStatusWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = OrderStatusWidget()
}
