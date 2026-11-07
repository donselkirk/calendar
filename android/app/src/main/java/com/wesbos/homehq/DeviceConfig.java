package com.wesbos.homehq;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;
import org.json.JSONArray;
import org.json.JSONObject;

final class DeviceConfig {
  private static final Pattern ID = Pattern.compile("[a-z0-9][a-z0-9-]{0,39}");
  private static final Pattern COLOR = Pattern.compile("#[0-9a-fA-F]{6}");
  private static final int MAX_BYTES = 64 * 1024;

  final boolean configured;
  final String familyLabel;
  final JSONArray people;
  final String wastePlaceId;
  final int wasteServiceId;

  private DeviceConfig(boolean configured, String familyLabel, JSONArray people,
      String wastePlaceId, int wasteServiceId) {
    this.configured = configured;
    this.familyLabel = familyLabel;
    this.people = people;
    this.wastePlaceId = wastePlaceId;
    this.wasteServiceId = wasteServiceId;
  }

  static DeviceConfig load(File filesDir) {
    File source = new File(filesDir, "device-config.json");
    if (!source.isFile()) return fallback();
    try {
      if (source.length() <= 0 || source.length() > MAX_BYTES) throw new IllegalArgumentException("invalid size");
      ByteArrayOutputStream bytes = new ByteArrayOutputStream();
      FileInputStream input = new FileInputStream(source);
      byte[] chunk = new byte[4096];
      int count;
      while ((count = input.read(chunk)) != -1) bytes.write(chunk, 0, count);
      input.close();
      JSONObject root = new JSONObject(new String(bytes.toByteArray(), StandardCharsets.UTF_8));
      if (root.optInt("schemaVersion", -1) != 1) throw new IllegalArgumentException("schemaVersion");
      String family = requiredText(root, "familyLabel", 60);
      JSONArray inputPeople = root.optJSONArray("people");
      if (inputPeople == null || inputPeople.length() < 1 || inputPeople.length() > 12) {
        throw new IllegalArgumentException("people");
      }
      JSONArray clean = new JSONArray();
      Set<String> ids = new HashSet<>();
      for (int i = 0; i < inputPeople.length(); i++) {
        JSONObject person = inputPeople.getJSONObject(i);
        String id = requiredText(person, "id", 40).toLowerCase(Locale.ROOT);
        String name = requiredText(person, "name", 60);
        String color = requiredText(person, "color", 7).toUpperCase(Locale.ROOT);
        String ink = requiredText(person, "ink", 7).toUpperCase(Locale.ROOT);
        if (!ID.matcher(id).matches() || !ids.add(id) || !COLOR.matcher(color).matches()
            || !COLOR.matcher(ink).matches()) throw new IllegalArgumentException("person");
        clean.put(new JSONObject().put("id", id).put("name", name).put("color", color).put("ink", ink));
      }
      JSONObject waste = root.optJSONObject("waste");
      String place = waste == null ? "" : requiredText(waste, "placeId", 160);
      int service = waste == null ? 0 : waste.optInt("serviceId", 0);
      if (service <= 0) throw new IllegalArgumentException("waste service");
      return new DeviceConfig(true, family, clean, place, service);
    } catch (Exception error) {
      // The public UI exposes only that setup is required; never log private configuration values.
      return fallback();
    }
  }

  JSONObject publicJson() {
    try {
      return new JSONObject()
          .put("schemaVersion", 1)
          .put("configured", configured)
          .put("familyLabel", familyLabel)
          .put("people", people)
          .put("wasteEnabled", configured && !wastePlaceId.isEmpty() && wasteServiceId > 0);
    } catch (org.json.JSONException impossible) {
      throw new AssertionError(impossible);
    }
  }

  private static String requiredText(JSONObject object, String name, int max) {
    String value = object.optString(name, "").trim();
    if (value.isEmpty() || value.length() > max) throw new IllegalArgumentException(name);
    return value;
  }

  private static DeviceConfig fallback() {
    JSONArray people = new JSONArray();
    people.put(person("person-1", "Person 1", "#2D5BFF", "#FFFFFF"));
    people.put(person("person-2", "Person 2", "#E4007C", "#FFFFFF"));
    people.put(person("person-3", "Person 3", "#00A36C", "#FFFFFF"));
    people.put(person("person-4", "Person 4", "#FFB000", "#111111"));
    return new DeviceConfig(false, "Family", people, "", 0);
  }

  private static JSONObject person(String id, String name, String color, String ink) {
    try {
      return new JSONObject().put("id", id).put("name", name).put("color", color).put("ink", ink);
    } catch (org.json.JSONException impossible) {
      throw new AssertionError(impossible);
    }
  }
}
