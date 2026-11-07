package com.wesbos.homehq;

import static org.junit.Assert.assertEquals;
import org.junit.Test;

public class MainActivityTest {
  @Test public void servesOnlyKnownMimeTypes() {
    assertEquals("text/html", MainActivity.mimeFor("index.html"));
    assertEquals("text/javascript", MainActivity.mimeFor("app.JS"));
    assertEquals("text/css", MainActivity.mimeFor("calendar.css"));
    assertEquals("image/png", MainActivity.mimeFor("icon.png"));
    assertEquals("application/octet-stream", MainActivity.mimeFor("unknown.bin"));
  }
}
