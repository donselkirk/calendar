package com.wesbos.homehq;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.util.Log;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

final class UpdateManager {
  static final String ACTION_CHECK = "com.wesbos.homehq.CHECK_UPDATE";
  static final String ACTION_INSTALL = "com.wesbos.homehq.INSTALL_UPDATE";
  static final String ACTION_NIGHTLY = "com.wesbos.homehq.NIGHTLY_UPDATE";
  static final String PREF_AUTO_ENABLED = "auto_updates_enabled";
  static final String PREF_DEFER_TONIGHT = "defer_update_tonight";
  private static final String TAG = "HomeHQ.Update";
  private static final String PREF = "updates";
  private static final String API = "https://api.github.com/repos/" + BuildConfig.GITHUB_OWNER + "/"
      + BuildConfig.GITHUB_REPO + "/releases/latest";
  private static final long MAX_MANIFEST = 64 * 1024;
  private static final long MAX_APK = 100 * 1024 * 1024;

  private UpdateManager() {}

  static JSONObject status(Context context) {
    SharedPreferences prefs = prefs(context);
    try {
      return new JSONObject()
          .put("currentVersionName", BuildConfig.VERSION_NAME)
          .put("currentVersionCode", BuildConfig.VERSION_CODE)
          .put("available", prefs.getInt("versionCode", 0) > BuildConfig.VERSION_CODE)
          .put("latestVersionName", prefs.getString("versionName", ""))
          .put("latestVersionCode", prefs.getInt("versionCode", 0))
          .put("state", prefs.getString("state", "idle"))
          .put("notes", prefs.getString("notes", ""))
          .put("error", prefs.getString("error", ""))
          .put("lastCheckedAt", prefs.getLong("lastCheckedAt", 0))
          .put("nextCheckAt", UpdateScheduler.nextCheckAt(context));
    } catch (org.json.JSONException impossible) {
      throw new AssertionError(impossible);
    }
  }

  static void showDialog(Activity activity) {
    SharedPreferences prefs = prefs(activity);
    int code = prefs.getInt("versionCode", 0);
    if (code <= BuildConfig.VERSION_CODE) {
      new AlertDialog.Builder(activity).setTitle("Home HQ is up to date")
          .setMessage("Version " + BuildConfig.VERSION_NAME + " is installed.")
          .setPositiveButton("Check again", (dialog, which) -> start(activity, ACTION_CHECK))
          .setNegativeButton("Close", null).show();
      return;
    }
    String name = prefs.getString("versionName", "");
    String notes = prefs.getString("notes", "");
    new AlertDialog.Builder(activity).setTitle("Update " + name + " is available")
        .setMessage(notes.isEmpty() ? "A verified Home HQ update is ready." : notes)
        .setPositiveButton("Update now", (dialog, which) -> start(activity, ACTION_INSTALL))
        .setNeutralButton("Tonight", (dialog, which) -> {
          prefs(activity).edit().putBoolean(PREF_DEFER_TONIGHT, true).apply();
          UpdateScheduler.scheduleNightly(activity);
        })
        .setNegativeButton("Later", null).show();
  }

  static void start(Context context, String action) {
    Intent intent = new Intent(context, UpdateService.class).setAction(action);
    context.startService(intent);
  }

  static void check(Context context) {
    state(context, "checking", "");
    HttpURLConnection connection = null;
    try {
      connection = open(API, "application/vnd.github+json");
      String etag = prefs(context).getString("etag", "");
      if (!etag.isEmpty()) connection.setRequestProperty("If-None-Match", etag);
      int status = connection.getResponseCode();
      if (status == 304) {
        prefs(context).edit().putLong("lastCheckedAt", System.currentTimeMillis()).putString("state", "idle")
            .putString("error", "").apply();
        return;
      }
      if (status != 200) throw new IllegalStateException("GitHub answered " + status);
      JSONObject release = new JSONObject(read(connection.getInputStream(), 512 * 1024));
      if (release.optBoolean("draft") || release.optBoolean("prerelease")) throw new IllegalArgumentException("non-final release");
      JSONArray assets = release.getJSONArray("assets");
      String manifestUrl = assetUrl(assets, "update-manifest.json");
      if (manifestUrl == null) throw new IllegalArgumentException("release manifest missing");
      String manifestBody = downloadText(manifestUrl, MAX_MANIFEST);
      UpdateManifest manifest = UpdateManifest.parse(manifestBody);
      if (!normalizeCert(manifest.signingCertSha256).equals(normalizeCert(BuildConfig.SIGNING_CERT_SHA256))) {
        throw new SecurityException("release signing policy mismatch");
      }
      String apkUrl = assetUrl(assets, manifest.apkAsset);
      if (apkUrl == null) throw new IllegalArgumentException("APK asset missing");
      prefs(context).edit()
          .putString("etag", connection.getHeaderField("ETag"))
          .putString("versionName", manifest.versionName).putInt("versionCode", manifest.versionCode)
          .putString("apkAsset", manifest.apkAsset).putString("apkUrl", apkUrl)
          .putString("sha256", manifest.sha256).putString("cert", manifest.signingCertSha256)
          .putString("notes", manifest.notes).putLong("lastCheckedAt", System.currentTimeMillis())
          .putString("state", "idle").putString("error", "").apply();
    } catch (Exception error) {
      Log.e(TAG, "Update check failed", error);
      state(context, "error", safeError(error));
    } finally {
      if (connection != null) connection.disconnect();
    }
  }

  static void nightly(Context context) {
    check(context);
    SharedPreferences app = context.getSharedPreferences(MainActivity.PREFS, Context.MODE_PRIVATE);
    SharedPreferences update = prefs(context);
    boolean requested = update.getBoolean(PREF_DEFER_TONIGHT, false)
        || update.getBoolean(PREF_AUTO_ENABLED, false);
    long now = System.currentTimeMillis();
    long lastTouch = app.getLong(ScreenSaverController.PREF_LAST_INTERACTION, 0);
    java.util.Calendar clock = java.util.Calendar.getInstance();
    int hour = clock.get(java.util.Calendar.HOUR_OF_DAY);
    if (!requested || "error".equals(update.getString("state", ""))
        || update.getInt("versionCode", 0) <= BuildConfig.VERSION_CODE) return;
    if (lastTouch > 0 && now - lastTouch < 10 * 60 * 1000L) {
      if (hour < 4) UpdateScheduler.retryNightly(context);
      return;
    }
    install(context);
  }

  static void install(Context context) {
    SharedPreferences prefs = prefs(context);
    if (prefs.getInt("versionCode", 0) <= BuildConfig.VERSION_CODE) return;
    state(context, "downloading", "");
    File directory = new File(context.getFilesDir(), "update");
    if (!directory.exists() && !directory.mkdirs()) {
      state(context, "error", "Could not create update staging directory");
      return;
    }
    File apk = new File(directory, "homehq-update.apk");
    try {
      downloadFile(prefs.getString("apkUrl", ""), apk, MAX_APK);
      String expectedHash = prefs.getString("sha256", "");
      if (!sha256(apk).equalsIgnoreCase(expectedHash)) throw new SecurityException("APK hash mismatch");
      verifyArchive(context, apk, prefs.getInt("versionCode", 0), prefs.getString("cert", ""));
      state(context, "installing", "");
      stageAndInstall(context, apk);
    } catch (Exception error) {
      Log.e(TAG, "Update installation failed", error);
      apk.delete();
      state(context, "error", safeError(error));
    }
  }

  private static void verifyArchive(Context context, File apk, int expectedCode, String expectedCert) throws Exception {
    PackageManager manager = context.getPackageManager();
    PackageInfo archive = manager.getPackageArchiveInfo(apk.getAbsolutePath(), PackageManager.GET_SIGNATURES);
    if (archive == null || !context.getPackageName().equals(archive.packageName)) throw new SecurityException("APK package mismatch");
    if (archive.versionCode != expectedCode || archive.versionCode <= BuildConfig.VERSION_CODE) {
      throw new SecurityException("APK version mismatch");
    }
    String archiveCert = signer(archive);
    PackageInfo installed = manager.getPackageInfo(context.getPackageName(), PackageManager.GET_SIGNATURES);
    String installedCert = signer(installed);
    if (!archiveCert.equals(installedCert) || !archiveCert.equals(normalizeCert(expectedCert))
        || !archiveCert.equals(normalizeCert(BuildConfig.SIGNING_CERT_SHA256))) {
      throw new SecurityException("APK signing certificate mismatch");
    }
  }

  private static String signer(PackageInfo info) throws Exception {
    Signature[] signatures = info.signatures;
    if (signatures == null || signatures.length != 1) throw new SecurityException("unexpected signer count");
    return hex(MessageDigest.getInstance("SHA-256").digest(signatures[0].toByteArray()));
  }

  private static void stageAndInstall(Context context, File apk) throws Exception {
    String data = context.getApplicationInfo().dataDir;
    String source = context.getApplicationInfo().sourceDir;
    String recovery = "/data/local/tmp/homehq-recovery";
    String staged = "/data/local/tmp/homehq-update.apk";
    String command = "set -e; mkdir -p " + q(recovery) + "; cp " + q(source) + " " + q(recovery + "/previous.apk")
        + "; cp " + q(apk.getAbsolutePath()) + " " + q(staged)
        + "; rm -rf " + q(new File(context.getFilesDir(), "update").getAbsolutePath())
        + "; tar -C " + q(data) + " -czf " + q(recovery + "/data.tgz") + " files shared_prefs app_webview 2>/dev/null"
        + "; pm install -r " + q(staged) + "; rm -f " + q(staged);
    Process process = Runtime.getRuntime().exec(new String[] {"su", "-c", command});
    int result = process.waitFor();
    if (result != 0) throw new IllegalStateException("Package installer exited " + result);
  }

  private static String q(String value) { return "'" + value.replace("'", "'\\''") + "'"; }

  private static HttpURLConnection open(String address, String accept) throws Exception {
    URL url = new URL(address);
    if (!"https".equalsIgnoreCase(url.getProtocol())) throw new SecurityException("HTTPS required");
    HttpURLConnection connection = (HttpURLConnection) url.openConnection();
    connection.setConnectTimeout(15_000);
    connection.setReadTimeout(20_000);
    connection.setInstanceFollowRedirects(true);
    connection.setUseCaches(false);
    connection.setRequestProperty("Accept", accept);
    connection.setRequestProperty("User-Agent", "HomeHQ/" + BuildConfig.VERSION_NAME);
    return connection;
  }

  private static String downloadText(String address, long limit) throws Exception {
    HttpURLConnection connection = open(address, "application/json");
    try {
      if (connection.getResponseCode() != 200) throw new IllegalStateException("download failed");
      return read(connection.getInputStream(), limit);
    } finally { connection.disconnect(); }
  }

  private static void downloadFile(String address, File target, long limit) throws Exception {
    HttpURLConnection connection = open(address, "application/vnd.android.package-archive");
    File partial = new File(target.getParentFile(), target.getName() + ".part");
    long count = 0;
    try {
      if (connection.getResponseCode() != 200) throw new IllegalStateException("APK download failed");
      InputStream input = connection.getInputStream();
      FileOutputStream output = new FileOutputStream(partial);
      byte[] chunk = new byte[16_384];
      int size;
      while ((size = input.read(chunk)) != -1) {
        count += size;
        if (count > limit) throw new IllegalArgumentException("APK exceeds size limit");
        output.write(chunk, 0, size);
      }
      output.getFD().sync();
      output.close();
      input.close();
      if (target.exists() && !target.delete()) throw new IllegalStateException("Could not replace old download");
      if (!partial.renameTo(target)) throw new IllegalStateException("Could not commit download");
    } finally {
      connection.disconnect();
      if (target.length() == 0) partial.delete();
    }
  }

  private static String read(InputStream input, long limit) throws Exception {
    ByteArrayOutputStream output = new ByteArrayOutputStream();
    byte[] chunk = new byte[8192];
    long count = 0;
    int size;
    while ((size = input.read(chunk)) != -1) {
      count += size;
      if (count > limit) throw new IllegalArgumentException("response exceeds size limit");
      output.write(chunk, 0, size);
    }
    input.close();
    return output.toString("UTF-8");
  }

  private static String assetUrl(JSONArray assets, String name) {
    for (int i = 0; i < assets.length(); i++) {
      JSONObject asset = assets.optJSONObject(i);
      if (asset != null && name.equals(asset.optString("name"))) {
        String url = asset.optString("browser_download_url", "");
        Uri parsed = Uri.parse(url);
        if ("https".equalsIgnoreCase(parsed.getScheme()) && "github.com".equalsIgnoreCase(parsed.getHost())) return url;
      }
    }
    return null;
  }

  private static String sha256(File file) throws Exception {
    MessageDigest digest = MessageDigest.getInstance("SHA-256");
    FileInputStream input = new FileInputStream(file);
    byte[] chunk = new byte[16_384];
    int size;
    while ((size = input.read(chunk)) != -1) digest.update(chunk, 0, size);
    input.close();
    return hex(digest.digest());
  }

  private static String hex(byte[] bytes) {
    StringBuilder output = new StringBuilder();
    for (byte value : bytes) output.append(String.format(Locale.ROOT, "%02X", value & 0xff));
    return output.toString();
  }

  private static String normalizeCert(String value) {
    return value == null ? "" : value.replace(":", "").toUpperCase(Locale.ROOT);
  }

  private static SharedPreferences prefs(Context context) {
    return context.getSharedPreferences(PREF, Context.MODE_PRIVATE);
  }

  private static void state(Context context, String state, String error) {
    prefs(context).edit().putString("state", state).putString("error", error).apply();
  }

  private static String safeError(Exception error) {
    String message = error.getMessage();
    return message == null || message.length() > 180 ? error.getClass().getSimpleName() : message;
  }
}
