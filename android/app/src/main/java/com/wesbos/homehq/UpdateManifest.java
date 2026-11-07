package com.wesbos.homehq;

import java.util.Locale;
import java.util.regex.Pattern;
import org.json.JSONObject;

final class UpdateManifest {
  private static final Pattern SHA256 = Pattern.compile("[0-9a-fA-F]{64}");
  final String versionName;
  final int versionCode;
  final String apkAsset;
  final String sha256;
  final String signingCertSha256;
  final String notes;

  private UpdateManifest(String versionName, int versionCode, String apkAsset, String sha256,
      String signingCertSha256, String notes) {
    this.versionName = versionName;
    this.versionCode = versionCode;
    this.apkAsset = apkAsset;
    this.sha256 = sha256;
    this.signingCertSha256 = signingCertSha256;
    this.notes = notes;
  }

  static UpdateManifest parse(String body) {
    try {
      JSONObject json = new JSONObject(body);
      if (json.optInt("schemaVersion", -1) != 1) throw new IllegalArgumentException("manifest schema");
      String name = json.optString("versionName", "").trim();
      int code = json.optInt("versionCode", -1);
      String asset = json.optString("apkAsset", "").trim();
      String sha = json.optString("sha256", "").replace(":", "").toUpperCase(Locale.ROOT);
      String cert = json.optString("signingCertSha256", "").replace(":", "").toUpperCase(Locale.ROOT);
      String notes = json.optString("notes", "");
      if (!name.matches("[0-9]+\\.[0-9]+\\.[0-9]+") || code <= 0
          || !asset.matches("homehq-v[0-9]+\\.[0-9]+\\.[0-9]+\\.apk")
          || !asset.equals("homehq-v" + name + ".apk")
          || !SHA256.matcher(sha).matches() || !SHA256.matcher(cert).matches()
          || notes.length() > 20_000) throw new IllegalArgumentException("invalid update manifest");
      return new UpdateManifest(name, code, asset, sha, cert, notes);
    } catch (org.json.JSONException error) {
      throw new IllegalArgumentException("malformed update manifest", error);
    }
  }
}
