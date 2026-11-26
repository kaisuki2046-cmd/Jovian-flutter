package com.jovian.preview;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import java.util.HashMap;
import java.util.Map;
import io.flutter.embedding.android.FlutterActivity;
import io.flutter.embedding.engine.FlutterEngine;
import io.flutter.plugin.common.MethodChannel;

public final class MainActivity extends FlutterActivity {
    @Override
    public void configureFlutterEngine(FlutterEngine flutterEngine) {
        super.configureFlutterEngine(flutterEngine);
        new MethodChannel(flutterEngine.getDartExecutor().getBinaryMessenger(), "jovian/app_updates")
            .setMethodCallHandler((call, result) -> {
                switch (call.method) {
                    case "installedVersion":
                        try {
                            PackageInfo info = getPackageManager().getPackageInfo(getPackageName(), 0);
                            long versionCode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                                ? info.getLongVersionCode() : info.versionCode;
                            Map<String, Object> version = new HashMap<>();
                            version.put("applicationId", getPackageName());
                            version.put("versionName", info.versionName);
                            version.put("versionCode", versionCode);
                            result.success(version);
                        } catch (PackageManager.NameNotFoundException error) {
                            result.error("version_unavailable", null, null);
                        }
                        break;
                    case "openDownload":
                        result.success(call.arguments instanceof String && openDownload((String) call.arguments));
                        break;
                    default:
                        result.notImplemented();
                }
            });
    }

    private boolean openDownload(String url) {
        Uri uri = Uri.parse(url);
        if (!"https".equals(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null) {
            return false;
        }
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
            return true;
        } catch (ActivityNotFoundException | SecurityException error) {
            return false;
        }
    }
}
