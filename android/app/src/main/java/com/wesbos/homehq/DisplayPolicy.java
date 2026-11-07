package com.wesbos.homehq;

final class DisplayPolicy {
  static final int ACTIVE = 0;
  static final int DIM = 1;
  static final int OFF = 2;
  static final long DAY_DIM_MS = 5 * 60 * 1000L;
  static final long NIGHT_DIM_MS = 2 * 60 * 1000L;
  static final long NIGHT_OFF_MS = 10 * 60 * 1000L;

  private DisplayPolicy() {}

  static int stateFor(int hour, long idleMs, boolean clockValid) {
    boolean night = clockValid && (hour >= 20 || hour < 7);
    if (night && idleMs >= NIGHT_OFF_MS) return OFF;
    if (idleMs >= (night ? NIGHT_DIM_MS : DAY_DIM_MS)) return DIM;
    return ACTIVE;
  }
}
