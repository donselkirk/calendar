package com.wesbos.homehq;

import static org.junit.Assert.assertEquals;
import org.junit.Test;

public class UpdateManifestTest {
  private static final String HASH = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

  @Test public void parsesStrictVersionedManifest() {
    UpdateManifest manifest = UpdateManifest.parse("{\"schemaVersion\":1,\"versionName\":\"1.12.0\","
        + "\"versionCode\":14,\"apkAsset\":\"homehq-v1.12.0.apk\",\"sha256\":\"" + HASH + "\","
        + "\"signingCertSha256\":\"" + HASH + "\",\"notes\":\"Fixes\"}");
    assertEquals("1.12.0", manifest.versionName);
    assertEquals(14, manifest.versionCode);
    assertEquals(HASH.toUpperCase(), manifest.sha256);
  }

  @Test(expected = IllegalArgumentException.class)
  public void rejectsUnknownSchema() {
    UpdateManifest.parse("{\"schemaVersion\":2}");
  }

  @Test(expected = IllegalArgumentException.class)
  public void rejectsAssetThatDoesNotMatchReleaseNamingPolicy() {
    UpdateManifest.parse("{\"schemaVersion\":1,\"versionName\":\"1.12.0\",\"versionCode\":14,"
        + "\"apkAsset\":\"other.apk\",\"sha256\":\"" + HASH + "\",\"signingCertSha256\":\"" + HASH + "\"}");
  }

  @Test public void rejectsMalformedVersionsHashesAndOversizedNotes() {
    String[] invalid = {
      "{broken",
      manifest("bad", 14, "homehq-v1.12.0.apk", HASH, HASH, ""),
      manifest("1.12.0", 0, "homehq-v1.12.0.apk", HASH, HASH, ""),
      manifest("1.12.0", 14, "homehq-v1.12.0.apk", "short", HASH, ""),
      manifest("1.12.0", 14, "homehq-v1.12.0.apk", HASH, "short", ""),
      manifest("1.12.0", 14, "homehq-v1.12.0.apk", HASH, HASH, new String(new char[20_001]).replace('\0', 'x'))
    };
    for (String body : invalid) {
      try {
        UpdateManifest.parse(body);
        org.junit.Assert.fail("Expected invalid manifest");
      } catch (IllegalArgumentException expected) {
        // expected
      }
    }
  }

  private static String manifest(String name, int code, String asset, String sha, String cert, String notes) {
    return "{\"schemaVersion\":1,\"versionName\":\"" + name + "\",\"versionCode\":" + code
        + ",\"apkAsset\":\"" + asset + "\",\"sha256\":\"" + sha
        + "\",\"signingCertSha256\":\"" + cert + "\",\"notes\":\"" + notes + "\"}";
  }
}
