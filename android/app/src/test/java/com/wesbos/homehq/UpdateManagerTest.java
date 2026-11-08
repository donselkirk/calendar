package com.wesbos.homehq;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import org.junit.Test;

public class UpdateManagerTest {
  @Test public void archiveCommandUsesOnlyPersistentApplicationData() {
    assertArrayEquals(new String[] {"tar", "-C", "/data/app-data", "-cf", "-",
        "files", "shared_prefs", "app_webview"}, UpdateManager.archiveCommand("/data/app-data"));
  }

  @Test public void installerExposesOnlyTheVerifiedTemporaryApkToPackageManager() {
    assertEquals("set -e; chmod 0644 '/data/local/tmp/homehq-update.apk'; "
        + "pm install -r '/data/local/tmp/homehq-update.apk'; "
        + "rm -f '/data/local/tmp/homehq-update.apk'",
        UpdateManager.installCommand("/data/local/tmp/homehq-update.apk"));
  }

  @Test public void copiesBinaryStreamsWithoutModification() throws Exception {
    byte[] source = new byte[40_000];
    for (int index = 0; index < source.length; index++) source[index] = (byte) (index % 251);
    ByteArrayOutputStream output = new ByteArrayOutputStream();
    UpdateManager.copy(new ByteArrayInputStream(source), output);
    assertEquals(source.length, output.size());
    assertArrayEquals(source, output.toByteArray());
  }
}
