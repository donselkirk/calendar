package com.wesbos.homehq;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotEquals;
import static org.junit.Assert.assertTrue;

import android.graphics.Color;
import java.util.Random;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 23)
public class AmbientViewTest {
  @Test public void coloursBlendAndClampForSlowTransitions() {
    int start = Color.argb(100, 10, 20, 30);
    int end = Color.argb(200, 110, 120, 130);
    assertEquals(start, ScreenSaverController.AmbientView.blend(start, end, -1f));
    assertEquals(Color.argb(150, 60, 70, 80), ScreenSaverController.AmbientView.blend(start, end, .5f));
    assertEquals(end, ScreenSaverController.AmbientView.blend(start, end, 2f));
    assertEquals(18_000L, ScreenSaverController.AmbientView.MIN_COLOR_MS);
    assertEquals(14_000L, ScreenSaverController.AmbientView.COLOR_RANGE_MS);
  }

  @Test public void motionAndPaletteContinueInDimModeAndResetOnReentry() {
    ScreenSaverController.AmbientView view = new ScreenSaverController.AmbientView(
        RuntimeEnvironment.getApplication(), new Random(23));
    long start = 2_000_000_000L;
    view.beginScene(start);
    float firstX = view.centerX(0, start);
    float firstY = view.centerY(0, start);
    int firstColor = view.colorAt(0, start);
    long later = start + 10_000L;
    assertTrue(Math.hypot(view.centerX(0, later) - firstX, view.centerY(0, later) - firstY) > .02);
    assertNotEquals(firstColor, view.colorAt(0, later));
    assertTrue(Color.alpha(firstColor) >= 175);
    assertTrue(Math.max(Color.red(firstColor), Math.max(Color.green(firstColor), Color.blue(firstColor))) >= 140);

    long boundary = start + 32_000L;
    int previousTarget = view.colorAt(0, boundary);
    view.advancePalette(boundary);
    assertEquals(previousTarget, view.colorAt(0, boundary));
    assertNotEquals(previousTarget, view.colorAt(0, boundary + 10_000L));

    view.beginScene(boundary + 60_000L);
    assertNotEquals(firstX, view.centerX(0, boundary + 60_000L), .001f);
    assertNotEquals(firstColor, view.colorAt(0, boundary + 60_000L));
  }
}
