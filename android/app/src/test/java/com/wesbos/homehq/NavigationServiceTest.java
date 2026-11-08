package com.wesbos.homehq;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class NavigationServiceTest {
  @Test public void pongMustBeRecentAndMonotonic() {
    assertTrue(NavigationService.pongIsRecent(10_000, 9_000));
    assertFalse(NavigationService.pongIsRecent(10_000, 0));
    assertFalse(NavigationService.pongIsRecent(10_000, 6_000));
    assertFalse(NavigationService.pongIsRecent(10_000, 11_000));
  }
}
