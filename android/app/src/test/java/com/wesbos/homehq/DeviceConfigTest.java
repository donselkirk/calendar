package com.wesbos.homehq;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import org.junit.Test;

public class DeviceConfigTest {
  @Test public void exposesDisplayValuesButNotPrivateWasteIdentifier() throws Exception {
    File directory = Files.createTempDirectory("homehq-config").toFile();
    String json = "{\"schemaVersion\":1,\"familyLabel\":\"Household\",\"people\":["
        + "{\"id\":\"stable-person\",\"name\":\"Display\",\"color\":\"#123456\",\"ink\":\"#ffffff\"}],"
        + "\"waste\":{\"placeId\":\"private-place\",\"serviceId\":208}}";
    FileOutputStream output = new FileOutputStream(new File(directory, "device-config.json"));
    output.write(json.getBytes(StandardCharsets.UTF_8));
    output.close();

    DeviceConfig config = DeviceConfig.load(directory);
    assertTrue(config.configured);
    assertEquals("private-place", config.wastePlaceId);
    assertEquals("Household", config.publicJson().getString("familyLabel"));
    assertFalse(config.publicJson().toString().contains("private-place"));
    assertTrue(config.publicJson().getBoolean("wasteEnabled"));
  }

  @Test public void invalidOrMissingConfigurationFallsBackSafely() throws Exception {
    File directory = Files.createTempDirectory("homehq-config-missing").toFile();
    DeviceConfig config = DeviceConfig.load(directory);
    assertFalse(config.configured);
    assertEquals("Family", config.familyLabel);
    assertFalse(config.publicJson().getBoolean("wasteEnabled"));
  }

  @Test public void rejectsMalformedSchemasPeopleAndWasteSettings() throws Exception {
    String[] invalid = {
      "{broken",
      "{\"schemaVersion\":2}",
      "{\"schemaVersion\":1,\"familyLabel\":\"Family\",\"people\":[]}",
      "{\"schemaVersion\":1,\"familyLabel\":\"\",\"people\":[{\"id\":\"one\",\"name\":\"One\",\"color\":\"#123456\",\"ink\":\"#ffffff\"}],\"waste\":{\"placeId\":\"p\",\"serviceId\":208}}",
      "{\"schemaVersion\":1,\"familyLabel\":\"Family\",\"people\":[{\"id\":\"BAD ID\",\"name\":\"One\",\"color\":\"#123456\",\"ink\":\"#ffffff\"}],\"waste\":{\"placeId\":\"p\",\"serviceId\":208}}",
      "{\"schemaVersion\":1,\"familyLabel\":\"Family\",\"people\":[{\"id\":\"one\",\"name\":\"One\",\"color\":\"red\",\"ink\":\"#ffffff\"}],\"waste\":{\"placeId\":\"p\",\"serviceId\":208}}",
      "{\"schemaVersion\":1,\"familyLabel\":\"Family\",\"people\":[{\"id\":\"one\",\"name\":\"One\",\"color\":\"#123456\",\"ink\":\"#ffffff\"},{\"id\":\"one\",\"name\":\"Again\",\"color\":\"#123456\",\"ink\":\"#ffffff\"}],\"waste\":{\"placeId\":\"p\",\"serviceId\":208}}",
      "{\"schemaVersion\":1,\"familyLabel\":\"Family\",\"people\":[{\"id\":\"one\",\"name\":\"One\",\"color\":\"#123456\",\"ink\":\"#ffffff\"}],\"waste\":{\"placeId\":\"p\",\"serviceId\":0}}"
    };
    for (String json : invalid) {
      File directory = Files.createTempDirectory("homehq-config-invalid").toFile();
      write(directory, json);
      assertFalse(DeviceConfig.load(directory).configured);
    }
  }

  private static void write(File directory, String json) throws Exception {
    FileOutputStream output = new FileOutputStream(new File(directory, "device-config.json"));
    output.write(json.getBytes(StandardCharsets.UTF_8));
    output.close();
  }
}
