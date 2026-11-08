package com.wesbos.homehq;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import org.junit.Test;

public class MainActivityTest {
  @Test public void servesOnlyKnownMimeTypes() {
    assertEquals("text/html", MainActivity.mimeFor("index.html"));
    assertEquals("text/javascript", MainActivity.mimeFor("app.JS"));
    assertEquals("text/css", MainActivity.mimeFor("calendar.css"));
    assertEquals("image/png", MainActivity.mimeFor("icon.png"));
    assertEquals("application/octet-stream", MainActivity.mimeFor("unknown.bin"));
  }

  @Test public void opensOnlyExactMainFrameUpdateNavigation() {
    assertTrue(MainActivity.isUpdateUiNavigation(true, "http", "127.0.0.1", 8765,
        "/__update_ui", null, null, null));
    assertFalse(MainActivity.isUpdateUiNavigation(false, "http", "127.0.0.1", 8765,
        "/__update_ui", null, null, null));
    assertFalse(MainActivity.isUpdateUiNavigation(true, "http", "127.0.0.1", 8765,
        "/__update_ui", "unexpected=true", null, null));
    assertFalse(MainActivity.isUpdateUiNavigation(true, "https", "example.com", 443,
        "/__update_ui", null, null, null));
  }
}
