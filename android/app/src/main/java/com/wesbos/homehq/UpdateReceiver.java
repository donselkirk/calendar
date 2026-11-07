package com.wesbos.homehq;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public final class UpdateReceiver extends BroadcastReceiver {
  @Override public void onReceive(Context context, Intent intent) {
    String action = intent == null ? "" : intent.getAction();
    if (Intent.ACTION_BOOT_COMPLETED.equals(action) || Intent.ACTION_TIME_CHANGED.equals(action)
        || Intent.ACTION_TIMEZONE_CHANGED.equals(action) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
      UpdateScheduler.schedule(context);
      if (Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) UpdateManager.start(context, UpdateManager.ACTION_CHECK);
      return;
    }
    if (UpdateManager.ACTION_NIGHTLY.equals(action)) {
      UpdateManager.start(context, UpdateManager.ACTION_NIGHTLY);
      UpdateScheduler.scheduleNightly(context);
    } else {
      UpdateManager.start(context, UpdateManager.ACTION_CHECK);
    }
  }
}
