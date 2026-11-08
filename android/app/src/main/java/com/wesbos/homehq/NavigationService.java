package com.wesbos.homehq;

import android.accessibilityservice.AccessibilityService;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.view.accessibility.AccessibilityEvent;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

/** Optional navigation for frames whose firmware omits the Android navigation bar. */
public class NavigationService extends AccessibilityService {
  private static final String ACTION_VISIBILITY = "com.wesbos.homehq.NAVIGATION_VISIBILITY";
  private static final String ACTION_PING = "com.wesbos.homehq.NAVIGATION_PING";
  private static final String PROCESS_PREFS = "navigation_process";
  private static final String PREF_VISIBLE = "dashboard_visible";
  private static final String PREF_PONG = "last_pong_elapsed";
  private static final long PONG_FRESH_MS = 3_000;
  private boolean dashboardVisible;
  private WindowManager windows;
  private LinearLayout bar;
  private WindowManager.LayoutParams position;
  private boolean attached;

  static void ping(Context context) {
    context.sendBroadcast(new Intent(ACTION_PING).setPackage(context.getPackageName()));
  }

  static boolean isRecentlyConnected(Context context, long nowElapsed) {
    long pong = context.getSharedPreferences(PROCESS_PREFS, Context.MODE_MULTI_PROCESS)
        .getLong(PREF_PONG, 0);
    return pongIsRecent(nowElapsed, pong);
  }

  static boolean pongIsRecent(long nowElapsed, long pongElapsed) {
    return pongElapsed > 0 && nowElapsed - pongElapsed >= 0
        && nowElapsed - pongElapsed <= PONG_FRESH_MS;
  }

  static void setDashboardVisible(Context context, boolean visible) {
    context.getSharedPreferences(PROCESS_PREFS, Context.MODE_MULTI_PROCESS).edit()
        .putBoolean(PREF_VISIBLE, visible).commit();
    context.sendBroadcast(new Intent(ACTION_VISIBILITY).setPackage(context.getPackageName())
        .putExtra(PREF_VISIBLE, visible));
  }

  private final BroadcastReceiver control = new BroadcastReceiver() {
    @Override public void onReceive(Context context, Intent intent) {
      if (ACTION_VISIBILITY.equals(intent.getAction())) {
        dashboardVisible = intent.getBooleanExtra(PREF_VISIBLE, false);
        updateVisibility();
      } else if (ACTION_PING.equals(intent.getAction())) {
        recordPong();
      }
    }
  };

  @Override
  protected void onServiceConnected() {
    dashboardVisible = getSharedPreferences(PROCESS_PREFS, MODE_MULTI_PROCESS)
        .getBoolean(PREF_VISIBLE, false);
    IntentFilter controls = new IntentFilter(ACTION_VISIBILITY);
    controls.addAction(ACTION_PING);
    registerReceiver(control, controls);
    recordPong();
    windows = (WindowManager) getSystemService(WINDOW_SERVICE);
    bar = new LinearLayout(this);
    bar.setGravity(Gravity.CENTER_VERTICAL);
    bar.setPadding(dp(4), dp(4), dp(4), dp(4));
    GradientDrawable background = new GradientDrawable();
    background.setColor(Color.rgb(28, 28, 28));
    background.setCornerRadius(dp(14));
    background.setStroke(dp(1), Color.GRAY);
    bar.setBackground(background);
    position = new WindowManager.LayoutParams(
        WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT,
        WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
            | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
        PixelFormat.TRANSLUCENT);
    position.gravity = Gravity.BOTTOM | Gravity.RIGHT;
    position.x = getSharedPreferences("kiosk", 0).getInt("nav_x", dp(12));
    position.y = getSharedPreferences("kiosk", 0).getInt("nav_y", dp(12));
    position.setTitle("Home HQ navigation");

    TextView handle = new TextView(this);
    handle.setText("\u22ee");
    handle.setTextColor(Color.LTGRAY);
    handle.setTextSize(26);
    handle.setGravity(Gravity.CENTER);
    handle.setContentDescription("Drag navigation buttons");
    bar.addView(handle, new LinearLayout.LayoutParams(dp(40), dp(48)));
    handle.setOnTouchListener(new View.OnTouchListener() {
      float startX, startY;
      int oldX, oldY;
      @Override public boolean onTouch(View view, MotionEvent event) {
        if (event.getActionMasked() == MotionEvent.ACTION_DOWN) {
          startX = event.getRawX(); startY = event.getRawY();
          oldX = position.x; oldY = position.y;
        } else if (event.getActionMasked() == MotionEvent.ACTION_MOVE) {
          int maxX = Math.max(0, getResources().getDisplayMetrics().widthPixels - bar.getWidth());
          int maxY = Math.max(0, getResources().getDisplayMetrics().heightPixels - bar.getHeight());
          position.x = Math.max(0, Math.min(maxX, oldX - (int) (event.getRawX() - startX)));
          position.y = Math.max(0, Math.min(maxY, oldY - (int) (event.getRawY() - startY)));
          windows.updateViewLayout(bar, position);
        } else if (event.getActionMasked() == MotionEvent.ACTION_UP) {
          getSharedPreferences("kiosk", 0).edit()
              .putInt("nav_x", position.x).putInt("nav_y", position.y).apply();
          view.performClick();
        }
        return true;
      }
    });
    addButton("Back", view -> performGlobalAction(GLOBAL_ACTION_BACK));
    addButton("Dashboard", view -> startActivity(new Intent(this, MainActivity.class)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP)));
    updateVisibility();
  }

  private void recordPong() {
    getSharedPreferences(PROCESS_PREFS, MODE_MULTI_PROCESS).edit()
        .putLong(PREF_PONG, android.os.SystemClock.elapsedRealtime()).commit();
  }

  private void addButton(String label, View.OnClickListener click) {
    Button button = new Button(this);
    button.setText(label);
    button.setAllCaps(false);
    button.setTextColor(Color.WHITE);
    button.setTextSize(17);
    button.setBackgroundColor(Color.TRANSPARENT);
    button.setPadding(dp(14), 0, dp(14), 0);
    button.setOnClickListener(click);
    bar.addView(button, new LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.WRAP_CONTENT, dp(48)));
  }

  private void updateVisibility() {
    if (bar == null) return;
    if (!dashboardVisible && !attached) {
      windows.addView(bar, position);
      attached = true;
    } else if (dashboardVisible && attached) {
      windows.removeView(bar);
      attached = false;
    }
  }

  private int dp(int value) {
    return Math.round(value * getResources().getDisplayMetrics().density);
  }

  // This service performs navigation actions; it does not inspect other apps' content.
  @Override public void onAccessibilityEvent(AccessibilityEvent event) { }
  @Override public void onInterrupt() { }
  @Override public void onDestroy() {
    if (attached) windows.removeView(bar);
    attached = false;
    try { unregisterReceiver(control); } catch (IllegalArgumentException ignored) { }
    super.onDestroy();
  }
}
