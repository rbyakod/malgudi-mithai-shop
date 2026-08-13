// apps/android/app/src/main/java/com/mishran/app/MishranApp.kt — Task 7.1.
//
// The @HiltAndroidApp Application triggers Hilt's code generation + creates the
// singleton component that every @AndroidEntryPoint + @HiltViewModel resolves
// against. The DI modules (network, database, repositories) are installed on
// this component in Task 7.3.
package com.mishran.app

import android.app.Application
import dagger.hilt.android.HiltAndroidApp

@HiltAndroidApp
class MishranApp : Application()
