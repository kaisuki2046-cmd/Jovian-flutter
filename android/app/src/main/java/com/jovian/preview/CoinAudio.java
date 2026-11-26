package com.jovian.preview;

import android.content.res.AssetFileDescriptor;
import android.content.res.AssetManager;
import android.media.AudioAttributes;
import android.media.SoundPool;
import io.flutter.FlutterInjector;
import io.flutter.plugin.common.MethodCall;
import io.flutter.plugin.common.MethodChannel;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

final class CoinAudio implements MethodChannel.MethodCallHandler {
    private final AssetManager assets;
    private final Set<Integer> loaded = new HashSet<>();
    private final List<Integer> streams = new ArrayList<>();
    private SoundPool pool;
    private int[] clips = new int[0];

    CoinAudio(AssetManager assets) {
        this.assets = assets;
    }

    @Override
    public void onMethodCall(MethodCall call, MethodChannel.Result result) {
        switch (call.method) {
            case "prepare":
                if (call.arguments instanceof List<?>) {
                    prepare((List<?>) call.arguments);
                }
                break;
            case "strike":
                Integer variant = call.argument("variant");
                Double volume = call.argument("volume");
                Double rate = call.argument("rate");
                if (variant != null && volume != null && rate != null) {
                    strike(variant, volume.floatValue(), rate.floatValue());
                }
                break;
            case "stop":
                stop();
                break;
            default:
                result.notImplemented();
                return;
        }
        result.success(null);
    }

    private void prepare(List<?> paths) {
        if (pool != null) return;
        AudioAttributes attributes = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
        pool = new SoundPool.Builder().setMaxStreams(4).setAudioAttributes(attributes).build();
        pool.setOnLoadCompleteListener((soundPool, sample, status) -> {
            if (soundPool == pool && status == 0) loaded.add(sample);
        });
        clips = new int[paths.size()];
        for (int index = 0; index < paths.size(); index++) {
            if (!(paths.get(index) instanceof String)) continue;
            String path = (String) paths.get(index);
            String key = FlutterInjector.instance().flutterLoader().getLookupKeyForAsset(path);
            try (AssetFileDescriptor file = assets.openFd(key)) {
                clips[index] = pool.load(file, 1);
            } catch (IOException ignored) {
                // A missing resource leaves the recorded toss usable.
            }
        }
    }

    private void strike(int variant, float volume, float rate) {
        if (pool == null || variant < 0 || variant >= clips.length) return;
        int clip = clips[variant];
        if (!loaded.contains(clip)) return;
        int stream = pool.play(clip, volume, volume, 1, 0, rate);
        if (stream != 0) streams.add(stream);
    }

    void stop() {
        if (pool == null) return;
        for (int stream : streams) pool.stop(stream);
        streams.clear();
    }

    void release() {
        if (pool == null) return;
        pool.setOnLoadCompleteListener(null);
        pool.release();
        pool = null;
        loaded.clear();
        streams.clear();
    }
}
