package com.wesbos.homehq;

import static org.junit.Assert.assertEquals;
import org.junit.Test;

public class DisplayPolicyTest {
  @Test public void daytimeDimsAtFiveMinutesAndNeverTurnsOff() {
    assertEquals(DisplayPolicy.ACTIVE, DisplayPolicy.stateFor(12, DisplayPolicy.DAY_DIM_MS - 1, true));
    assertEquals(DisplayPolicy.DIM, DisplayPolicy.stateFor(12, DisplayPolicy.DAY_DIM_MS, true));
    assertEquals(DisplayPolicy.DIM, DisplayPolicy.stateFor(12, 24 * 60 * 60 * 1000L, true));
  }

  @Test public void nighttimeDimsAtTwoAndBlacksAtTenMinutes() {
    assertEquals(DisplayPolicy.ACTIVE, DisplayPolicy.stateFor(20, DisplayPolicy.NIGHT_DIM_MS - 1, true));
    assertEquals(DisplayPolicy.DIM, DisplayPolicy.stateFor(23, DisplayPolicy.NIGHT_DIM_MS, true));
    assertEquals(DisplayPolicy.OFF, DisplayPolicy.stateFor(6, DisplayPolicy.NIGHT_OFF_MS, true));
  }

  @Test public void sevenAmAndInvalidClockUseSafeDayPolicy() {
    assertEquals(DisplayPolicy.DIM, DisplayPolicy.stateFor(7, DisplayPolicy.NIGHT_OFF_MS, true));
    assertEquals(DisplayPolicy.DIM, DisplayPolicy.stateFor(1, DisplayPolicy.DAY_DIM_MS, false));
  }
}
