package com.wesbos.homehq;

import android.app.Activity;
import android.content.SharedPreferences;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RadialGradient;
import android.graphics.Shader;
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
import java.util.Random;

final class ScreenSaverController {
  private static final long CLOCK_MIN = 1577836800000L;
  private static final String PREF_STATE = "display_state";
  static final String PREF_LAST_INTERACTION = "last_interaction_wall";
  private final Activity activity;
  private final SharedPreferences prefs;
  private final Handler handler;
  private final FrameLayout overlay;
  private final AmbientView ambient;
  private final LinearLayout clockBox;
  private final TextView time;
  private final TextView date;
  private long lastInteractionElapsed;
  private int state;
  private int shiftStep;
  private final Runnable finishBlackout = new Runnable() {
    @Override public void run() {
      if (state != DisplayPolicy.OFF) return;
      WindowManager.LayoutParams params = activity.getWindow().getAttributes();
      params.screenBrightness = 0f;
      activity.getWindow().setAttributes(params);
    }
  };

  ScreenSaverController(Activity activity, FrameLayout root, Handler handler) {
    this.activity = activity;
    this.handler = handler;
    prefs = activity.getSharedPreferences(MainActivity.PREFS, Activity.MODE_PRIVATE);
    lastInteractionElapsed = SystemClock.elapsedRealtime();
    state = prefs.getInt(PREF_STATE, DisplayPolicy.ACTIVE);

    overlay = new FrameLayout(activity);
    overlay.setClickable(false);
    overlay.setBackgroundColor(Color.BLACK);
    overlay.setVisibility(View.GONE);
    ambient = new AmbientView(activity);
    overlay.addView(ambient, new FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
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

  void stop() { handler.removeCallbacks(tick); handler.removeCallbacks(finishBlackout); ambient.stop(); }

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
    int previous = state;
    state = next;
    prefs.edit().putInt(PREF_STATE, state).apply();
    handler.removeCallbacks(finishBlackout);
    WindowManager.LayoutParams params = activity.getWindow().getAttributes();
    if (state == DisplayPolicy.ACTIVE) {
      params.screenBrightness = WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE;
      ambient.stop();
      overlay.animate().cancel();
      overlay.animate().alpha(0f).setDuration(550L).withEndAction(new Runnable() {
        @Override public void run() { if (state == DisplayPolicy.ACTIVE) overlay.setVisibility(View.GONE); }
      }).start();
    } else {
      ambient.setOff(state == DisplayPolicy.OFF);
      if (state == DisplayPolicy.OFF) {
        time.animate().cancel(); date.animate().cancel();
        time.animate().alpha(0f).setDuration(700L).withEndAction(new Runnable() {
          @Override public void run() { if (state == DisplayPolicy.OFF) time.setVisibility(View.GONE); }
        }).start();
        date.animate().alpha(0f).setDuration(700L).withEndAction(new Runnable() {
          @Override public void run() { if (state == DisplayPolicy.OFF) date.setVisibility(View.GONE); }
        }).start();
      } else {
        time.setVisibility(View.VISIBLE); date.setVisibility(View.VISIBLE);
      }
      params.screenBrightness = .12f;
      if (state == DisplayPolicy.OFF) handler.postDelayed(finishBlackout, 900L);
      if (overlay.getVisibility() != View.VISIBLE) {
        overlay.setAlpha(0f);
        overlay.setVisibility(View.VISIBLE);
        overlay.animate().cancel();
        overlay.animate().alpha(1f).setDuration(700L).start();
      } else if (previous == DisplayPolicy.OFF && state == DisplayPolicy.DIM) {
        time.setAlpha(0f); date.setAlpha(0f);
        time.animate().alpha(.72f).setDuration(700L).start();
        date.animate().alpha(.55f).setDuration(700L).start();
      }
      overlay.setVisibility(View.VISIBLE);
      overlay.bringToFront();
    }
    activity.getWindow().setAttributes(params);
  }

  /** A deliberately slow, low-contrast field that avoids leaving the same pixels lit all night. */
  static final class AmbientView extends View {
    static final long MIN_COLOR_MS = 18_000L;
    static final long COLOR_RANGE_MS = 14_000L;
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Random random = new Random();
    private final float[] phase = new float[3];
    private final float[] speed = new float[3];
    private final int[] from = new int[3];
    private final int[] to = new int[3];
    private long colorStart;
    private long colorDuration;
    private boolean running;
    private boolean off;

    AmbientView(android.content.Context context) {
      super(context);
      for (int i = 0; i < 3; i++) {
        phase[i] = random.nextFloat() * 6.283f;
        speed[i] = .000018f + random.nextFloat() * .000020f;
        from[i] = randomColor();
        to[i] = randomColor();
      }
      resetColorClock(SystemClock.elapsedRealtime());
    }

    void setOff(boolean value) {
      off = value;
      running = !value;
      if (!value) { randomizeMotion(); invalidate(); }
      animate().cancel();
      animate().alpha(value ? 0f : 1f).setDuration(900L).start();
    }

    void stop() { running = false; }

    private void randomizeMotion() {
      for (int i = 0; i < 3; i++) {
        phase[i] = random.nextFloat() * 6.283f;
        speed[i] = .000018f + random.nextFloat() * .000020f;
      }
    }

    private int randomColor() {
      float hue = random.nextFloat() * 360f;
      return Color.HSVToColor(125, new float[] {hue, .48f + random.nextFloat() * .25f, .42f + random.nextFloat() * .2f});
    }

    private void resetColorClock(long now) {
      colorStart = now;
      colorDuration = MIN_COLOR_MS + (long) (random.nextFloat() * COLOR_RANGE_MS);
    }

    @Override protected void onDraw(Canvas canvas) {
      super.onDraw(canvas);
      canvas.drawColor(Color.rgb(5, 7, 9));
      if (off) return;
      long now = SystemClock.elapsedRealtime();
      float progress = Math.min(1f, (now - colorStart) / (float) colorDuration);
      float eased = progress * progress * (3f - 2f * progress);
      int width = getWidth(), height = getHeight();
      for (int i = 0; i < 3; i++) {
        float x = width * (.5f + .38f * (float) Math.sin(phase[i] + now * speed[i]));
        float y = height * (.5f + .38f * (float) Math.cos(phase[i] * 1.37f + now * speed[i] * .77f));
        float radius = Math.max(width, height) * (.34f + i * .06f);
        int color = blend(from[i], to[i], eased);
        paint.setShader(new RadialGradient(x, y, radius, color, Color.TRANSPARENT, Shader.TileMode.CLAMP));
        canvas.drawCircle(x, y, radius, paint);
      }
      paint.setShader(null);
      canvas.drawColor(Color.argb(150, 0, 0, 0));
      if (progress >= 1f) {
        for (int i = 0; i < 3; i++) { from[i] = to[i]; to[i] = randomColor(); }
        resetColorClock(now);
      }
      if (running) postInvalidateDelayed(33L);
    }

    static int blend(int a, int b, float amount) {
      amount = Math.max(0f, Math.min(1f, amount));
      return Color.argb(
          Math.round(Color.alpha(a) + (Color.alpha(b) - Color.alpha(a)) * amount),
          Math.round(Color.red(a) + (Color.red(b) - Color.red(a)) * amount),
          Math.round(Color.green(a) + (Color.green(b) - Color.green(a)) * amount),
          Math.round(Color.blue(a) + (Color.blue(b) - Color.blue(a)) * amount));
    }
  }
}
