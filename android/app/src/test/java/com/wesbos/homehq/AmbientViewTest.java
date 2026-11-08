package com.wesbos.homehq;

import static org.junit.Assert.assertEquals;

import android.graphics.Color;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
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
}
