package com.wesbos.homehq;

import android.net.Uri;
import android.util.AtomicFile;
import java.io.File;
import java.io.FileOutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

final class ServiceAddress {
  static final String STATUS = "/__device/v1/status";
  static final String UPDATE = "/__device/v1/update";
  static final int UNAVAILABLE = 0, READY = 1, INCOMPATIBLE = 2;
  private static final String FILE = "service-address";

  static String canonical(String source) {
    if (source == null || source.length() > 100) return null;
    try {
      URI uri = new URI(source);
      String host = uri.getHost();
      int port = uri.getPort();
      if (!"http".equals(uri.getScheme()) || !privateHost(host) || port < 1024 || port > 65535
          || uri.getRawUserInfo() != null || uri.getRawQuery() != null || uri.getRawFragment() != null
          || !("".equals(uri.getRawPath()) || "/".equals(uri.getRawPath()))) return null;
      return "http://" + host + ":" + port + "/";
    } catch (Exception error) { return null; }
  }

  private static boolean privateHost(String host) {
    if (host == null || !host.matches("(0|[1-9][0-9]{0,2})(\\.(0|[1-9][0-9]{0,2})){3}")) return false;
    String[] parts = host.split("\\.");
    for (String part : parts) if (Integer.parseInt(part) > 255) return false;
    int second = Integer.parseInt(parts[1]);
    return "10".equals(parts[0]) || ("192".equals(parts[0]) && second == 168)
        || ("172".equals(parts[0]) && second >= 16 && second <= 31);
  }

  static boolean sameOrigin(Uri uri, String address) {
    if (uri == null || address == null) return false;
    Uri base = Uri.parse(address);
    return "http".equals(uri.getScheme()) && base.getHost().equals(uri.getHost())
        && base.getPort() == uri.getPort() && uri.getUserInfo() == null;
  }

  static boolean exact(Uri uri, String address, String path) {
    return sameOrigin(uri, address) && path.equals(uri.getEncodedPath())
        && uri.getEncodedQuery() == null && uri.getEncodedFragment() == null;
  }

  static String load(File dir) {
    AtomicFile file = new AtomicFile(new File(dir, FILE));
    if (file.getBaseFile().length() > 128) return null;
    try { return canonical(new String(file.readFully(), StandardCharsets.UTF_8).trim()); }
    catch (Exception error) { return null; }
  }

  static boolean save(File dir, String address) {
    if (canonical(address) == null) return false;
    AtomicFile file = new AtomicFile(new File(dir, FILE));
    FileOutputStream out = null;
    try {
      out = file.startWrite();
      out.write(address.getBytes(StandardCharsets.UTF_8));
      file.finishWrite(out);
      return true;
    } catch (Exception error) {
      if (out != null) file.failWrite(out);
      return false;
    }
  }

  static int probe(String address) {
    HttpURLConnection connection = null;
    try {
      connection = (HttpURLConnection) new URL(address + "readyz").openConnection();
      connection.setInstanceFollowRedirects(false);
      connection.setConnectTimeout(3000);
      connection.setReadTimeout(3000);
      connection.setUseCaches(false);
      if (connection.getResponseCode() != 200) return UNAVAILABLE;
      byte[] bytes = new byte[4096];
      int offset = 0;
      try (java.io.InputStream in = connection.getInputStream()) {
        int count;
        while (offset < bytes.length && (count = in.read(bytes, offset, bytes.length - offset)) > 0) offset += count;
      }
      if (offset == bytes.length) return INCOMPATIBLE;
      JSONObject reply = new JSONObject(new String(bytes, 0, offset, StandardCharsets.UTF_8));
      return "homehq-service".equals(reply.optString("product")) && reply.optInt("kioskProtocol") == 1
          ? READY : INCOMPATIBLE;
    } catch (org.json.JSONException error) { return INCOMPATIBLE; }
    catch (Exception error) { return UNAVAILABLE; }
    finally { if (connection != null) connection.disconnect(); }
  }
}
