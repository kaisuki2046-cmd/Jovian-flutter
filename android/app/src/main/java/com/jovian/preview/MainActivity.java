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
import io.flutter.plugin.common.StandardMethodCodec;

public final class MainActivity extends FlutterActivity {
    private CoinAudio coinAudio;
    private MethodChannel coinAudioChannel;
    private MethodChannel readingReferenceChannel;
    private MethodChannel attachmentPreviewChannel;
    private MethodChannel legacyPreferencesChannel;
    private MethodChannel legacyReadingChannel;

    @Override
    public void configureFlutterEngine(FlutterEngine flutterEngine) {
        super.configureFlutterEngine(flutterEngine);
        coinAudio = new CoinAudio(getAssets());
        coinAudioChannel = new MethodChannel(
            flutterEngine.getDartExecutor().getBinaryMessenger(), "jovian/coin_audio");
        coinAudioChannel.setMethodCallHandler(coinAudio);
        readingReferenceChannel = new MethodChannel(
            flutterEngine.getDartExecutor().getBinaryMessenger(), "jovian/reading_reference");
        readingReferenceChannel.setMethodCallHandler((call, result) -> {
            if ("open".equals(call.method)) {
                result.success(call.arguments instanceof String && openHttpsLink((String) call.arguments));
            } else {
                result.notImplemented();
            }
        });
        attachmentPreviewChannel = new MethodChannel(
            flutterEngine.getDartExecutor().getBinaryMessenger(), "jovian/attachment_preview");
        attachmentPreviewChannel.setMethodCallHandler((call, result) -> {
            if ("open".equals(call.method)) {
                if (call.arguments instanceof Map<?, ?> arguments
                        && arguments.get("path") instanceof String path) {
                    Object type = arguments.get("mimeType");
                    result.success(AttachmentPreviewProvider.open(
                        this, path, type instanceof String mime ? mime : null));
                } else {
                    result.success(false);
                }
            } else {
                result.notImplemented();
            }
        });
        var messenger = flutterEngine.getDartExecutor().getBinaryMessenger();
        legacyPreferencesChannel = new MethodChannel(messenger, "jovian/legacy_preferences",
            StandardMethodCodec.INSTANCE, messenger.makeBackgroundTaskQueue());
        legacyPreferencesChannel.setMethodCallHandler((call, result) -> {
            switch (call.method) {
                case "read":
                    result.success(LegacyPreferences.read(this));
                    break;
                case "readProfile":
                    result.success(call.arguments instanceof String key
                        ? LegacyPreferences.readProfile(this, key) : null);
                    break;
                case "clearProfile":
                    result.success(call.arguments instanceof String key
                        && LegacyPreferences.clearProfile(this, key));
                    break;
                default:
                    result.notImplemented();
            }
        });
        legacyReadingChannel = new MethodChannel(messenger, "jovian/legacy_reading",
            StandardMethodCodec.INSTANCE, messenger.makeBackgroundTaskQueue());
        legacyReadingChannel.setMethodCallHandler((call, result) -> {
            if (!(call.arguments instanceof Map<?, ?> arguments)
                    || !(arguments.get("owner") instanceof String owner)
                    || !(arguments.get("chatId") instanceof String chatId)) {
                result.error("invalid_legacy_reading_scope", null, null);
                return;
            }
            switch (call.method) {
                case "read":
                    result.success(LegacyPreferences.readReading(this, owner, chatId));
                    break;
                case "clear":
                    if (LegacyPreferences.clearMemberReading(this, owner, chatId)) {
                        result.success(null);
                    } else {
                        result.error("legacy_reading_cleanup_failed", null, null);
                    }
                    break;
                default:
                    result.notImplemented();
            }
        });
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
                        result.success(call.arguments instanceof String && openHttpsLink((String) call.arguments));
                        break;
                    default:
                        result.notImplemented();
                }
            });
    }

    @Override
    protected void onPause() {
        if (coinAudio != null) coinAudio.stop();
        super.onPause();
    }

    @Override
    public void cleanUpFlutterEngine(FlutterEngine flutterEngine) {
        if (coinAudioChannel != null) coinAudioChannel.setMethodCallHandler(null);
        if (readingReferenceChannel != null) readingReferenceChannel.setMethodCallHandler(null);
        if (attachmentPreviewChannel != null) attachmentPreviewChannel.setMethodCallHandler(null);
        if (legacyPreferencesChannel != null) legacyPreferencesChannel.setMethodCallHandler(null);
        if (legacyReadingChannel != null) legacyReadingChannel.setMethodCallHandler(null);
        if (coinAudio != null) coinAudio.release();
        super.cleanUpFlutterEngine(flutterEngine);
    }

    private boolean openHttpsLink(String url) {
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
