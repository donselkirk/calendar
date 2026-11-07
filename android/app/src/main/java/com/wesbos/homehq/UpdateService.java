package com.wesbos.homehq;

import android.app.IntentService;
import android.content.Intent;

public final class UpdateService extends IntentService {
  public UpdateService() { super("HomeHQUpdate"); }

  @Override protected void onHandleIntent(Intent intent) {
    String action = intent == null ? "" : intent.getAction();
    if (UpdateManager.ACTION_INSTALL.equals(action)) UpdateManager.install(this);
    else if (UpdateManager.ACTION_NIGHTLY.equals(action)) UpdateManager.nightly(this);
    else UpdateManager.check(this);
  }
}
