package com.wesbos.homehq;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import org.junit.Test;

public class MainActivityTest {
  @Test public void acceptsOnlyExplicitPrivateServiceAddress() {
    assertEquals("http://192.168.50.2:8080/", ServiceAddress.canonical("http://192.168.50.2:8080"));
    assertNull(ServiceAddress.canonical("http://127.0.0.1:8765/"));
    assertNull(ServiceAddress.canonical("http://192.168.50.2:8080/a"));
    assertNull(ServiceAddress.canonical("http://user@192.168.50.2:8080/"));
    assertNull(ServiceAddress.canonical("http://192.168.50.2:8080/?x=y"));
  }

  @Test public void checksExactUpdateNavigationOriginAndPath() {
    String address = "http://192.168.50.2:8080/";
    assertTrue(ServiceAddress.exact(address + "__device/v1/update", address, ServiceAddress.UPDATE));
    assertFalse(ServiceAddress.exact(address + "__device/v1/update?x=y", address, ServiceAddress.UPDATE));
    assertFalse(ServiceAddress.exact(address + "__device/v1/%75pdate", address, ServiceAddress.UPDATE));
    assertFalse(ServiceAddress.exact("http://192.168.50.3:8080/__device/v1/update",
        address, ServiceAddress.UPDATE));
    assertFalse(ServiceAddress.exact("http://192.168.50.2:8080@192.168.50.3/__device/v1/update",
        address, ServiceAddress.UPDATE));
  }
}
