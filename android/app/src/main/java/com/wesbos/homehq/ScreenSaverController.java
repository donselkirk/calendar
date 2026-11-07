package com.wesbos.homehq;

import android.app.Activity;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Handler;
import android.os.SystemClock;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

final class ScreenSaverController {
  private static final long CLOCK_MIN = 1577836800000L;
  private static final String PREF_STATE = "display_state";
  static final String PREF_LAST_INTERACTION = "last_interaction_wall";
  private final Activity activity;
  private final SharedPreferences prefs;
  private final Handler handler;
  private final FrameLayout overlay;
  private final LinearLayout clockBox;
  private final TextView time;
  private final TextView date;
  private long lastInteractionElapsed;
  private int state;
  private int shiftStep;

  ScreenSaverController(Activity activity, FrameLayout root, Handler handler) {
    this.activity = activity;
    this.handler = handler;
    prefs = activity.getSharedPreferences(MainActivity.PREFS, Activity.MODE_PRIVATE);
    lastInteractionElapsed = SystemClock.elapsedRealtime();
    state = prefs.getInt(PREF_STATE, DisplayPolicy.ACTIVE);

    overlay = new FrameLayout(activity);
    overlay.setClickable(false);
    overlay.setVisibility(View.GONE);
    clockBox = new LinearLayout(activity);
    clockBox.setOrientation(LinearLayout.VERTICAL);
    clockBox.setGravity(Gravity.CENTER);
    time = new TextView(activity);
    time.setTextColor(Color.WHITE);
    time.setTextSize(TypedValue.COMPLEX_UNIT_SP, 112);
    time.setGravity(Gravity.CENTER);
    time.setAlpha(.72f);
    date = new TextView(activity);
    date.setTextColor(Color.WHITE);
    date.setTextSize(TypedValue.COMPLEX_UNIT_SP, 30);
    date.setGravity(Gravity.CENTER);
    date.setAlpha(.55f);
    clockBox.addView(time);
    clockBox.addView(date);
    FrameLayout.LayoutParams centered = new FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.CENTER);
    overlay.addView(clockBox, centered);
    root.addView(overlay, new FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
    if (state != DisplayPolicy.ACTIVE) apply(state);
    handler.post(tick);
  }

  boolean isObscured() { return state != DisplayPolicy.ACTIVE; }

  void noteInteraction() {
    lastInteractionElapsed = SystemClock.elapsedRealtime();
    long wall = System.currentTimeMillis();
    if (wall >= CLOCK_MIN) prefs.edit().putLong(PREF_LAST_INTERACTION, wall).apply();
  }

  void wake() {
    noteInteraction();
    apply(DisplayPolicy.ACTIVE);
  }

  void stop() { handler.removeCallbacks(tick); }

  private final Runnable tick = new Runnable() {
    @Override public void run() {
      long wall = System.currentTimeMillis();
      boolean valid = wall >= CLOCK_MIN;
      Date now = new Date(wall);
      long idle = Math.max(0, SystemClock.elapsedRealtime() - lastInteractionElapsed);
      int target = DisplayPolicy.stateFor(valid ? now.getHours() : 12, idle, valid);
      apply(target);
      updateClock(now, valid);
      handler.postDelayed(this, 30_000L);
    }
  };

  private void updateClock(Date now, boolean valid) {
    time.setText(valid ? new SimpleDateFormat("h:mm", Locale.CANADA).format(now) : "—:—");
    date.setText(valid ? new SimpleDateFormat("EEEE, MMMM d", Locale.CANADA).format(now) : "Setting the date…");
    shiftStep = (shiftStep + 1) % 9;
    clockBox.setTranslationX((shiftStep % 3 - 1) * 10f);
    clockBox.setTranslationY((shiftStep / 3 - 1) * 8f);
  }

  private void apply(int next) {
    if (next == state && (next == DisplayPolicy.ACTIVE) == (overlay.getVisibility() == View.GONE)) return;
    state = next;
    prefs.edit().putInt(PREF_STATE, state).apply();
    WindowManager.LayoutParams params = activity.getWindow().getAttributes();
    if (state == DisplayPolicy.ACTIVE) {
      params.screenBrightness = WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE;
      overlay.setVisibility(View.GONE);
    } else {
      overlay.setBackgroundColor(state == DisplayPolicy.OFF ? Color.BLACK : Color.argb(218, 0, 0, 0));
      time.setVisibility(state == DisplayPolicy.OFF ? View.GONE : View.VISIBLE);
      date.setVisibility(state == DisplayPolicy.OFF ? View.GONE : View.VISIBLE);
      params.screenBrightness = state == DisplayPolicy.OFF ? 0f : .12f;
      overlay.setVisibility(View.VISIBLE);
      overlay.bringToFront();
    }
    activity.getWindow().setAttributes(params);
  }
}
