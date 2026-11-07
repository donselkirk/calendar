package com.wesbos.homehq;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.SystemClock;
import java.util.Calendar;

final class UpdateScheduler {
  private static final long SIX_HOURS = 6 * 60 * 60 * 1000L;
  private static final int CHECK_REQUEST = 6101;
  private static final int NIGHT_REQUEST = 6102;
  private static final int NIGHT_RETRY_REQUEST = 6103;
  private static final String PREF = "updates";
  private UpdateScheduler() {}

  static void schedule(Context context) {
    AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
    long first = SystemClock.elapsedRealtime() + SIX_HOURS;
    alarms.setInexactRepeating(AlarmManager.ELAPSED_REALTIME_WAKEUP, first, SIX_HOURS,
        pending(context, UpdateManager.ACTION_CHECK, CHECK_REQUEST));
    context.getSharedPreferences(PREF, Context.MODE_PRIVATE).edit()
        .putLong("nextCheckAt", System.currentTimeMillis() + SIX_HOURS).apply();
    scheduleNightly(context);
  }

  static void scheduleNightly(Context context) {
    long now = System.currentTimeMillis();
    if (now < 1577836800000L) return;
    Calendar next = Calendar.getInstance();
    next.set(Calendar.HOUR_OF_DAY, 2);
    next.set(Calendar.MINUTE, 0);
    next.set(Calendar.SECOND, 0);
    next.set(Calendar.MILLISECOND, 0);
    if (next.getTimeInMillis() <= now) next.add(Calendar.DAY_OF_YEAR, 1);
    AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
    alarms.setExact(AlarmManager.RTC_WAKEUP, next.getTimeInMillis(),
        pending(context, UpdateManager.ACTION_NIGHTLY, NIGHT_REQUEST));
  }

  static void retryNightly(Context context) {
    AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
    alarms.setExact(AlarmManager.ELAPSED_REALTIME_WAKEUP, SystemClock.elapsedRealtime() + 15 * 60 * 1000L,
        pending(context, UpdateManager.ACTION_NIGHTLY, NIGHT_RETRY_REQUEST));
  }

  static long nextCheckAt(Context context) {
    return context.getSharedPreferences(PREF, Context.MODE_PRIVATE).getLong("nextCheckAt", 0);
  }

  private static PendingIntent pending(Context context, String action, int request) {
    Intent intent = new Intent(context, UpdateReceiver.class).setAction(action);
    return PendingIntent.getBroadcast(context, request, intent,
        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
  }
}
