package com.jovian.preview;

import android.content.Context;
import android.util.Base64;
import java.io.File;
import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.Key;
import java.security.KeyStore;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Pattern;
import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONException;
import org.json.JSONObject;

/** Accesses the Expo SecureStore entries carried over by an in-place update. */
final class LegacyPreferences {
    private static final String RECORD_PREFIX = "key_v1-";
    private static final String AVATAR_PREFIX = "jovian.avatar.v1.";
    private static final Pattern PROFILE_KEY = Pattern.compile(
        "jovian\\.(?:avatar|profile-details)\\.v1\\."
        + "(?:6d-65-6d-62-65-72|67-75-65-73-74)-3a(?:-[0-9a-f]{1,6}){1,128}");
    private static final String READING_PREFIX = "jovian.divination.";
    private static final Pattern READING_OWNER = Pattern.compile(
        "(?:member|guest)\\.[0-9a-f]{1,6}(?:_[0-9a-f]{1,6}){0,127}");
    private static final Pattern READING_CHAT = Pattern.compile("[a-z0-9-]{1,100}");
    private static final String CIPHER = "AES/GCM/NoPadding";
    private static final String ALIAS = CIPHER + ":key_v1:keystoreUnauthenticated";

    private LegacyPreferences() {}

    static String read(Context context) {
        return readRecord(context, "jovian.preferences.v1");
    }

    static String readProfile(Context context, String key) {
        if (!PROFILE_KEY.matcher(key).matches()) return null;
        String value = readRecord(context, key);
        if (!key.startsWith(AVATAR_PREFIX)) return value;
        File avatar = avatarFile(context, value);
        return avatar == null ? null : avatar.getName();
    }

    static boolean clearProfile(Context context, String key) {
        if (!PROFILE_KEY.matcher(key).matches()) return false;
        if (key.startsWith(AVATAR_PREFIX)) {
            File avatar = avatarFile(context, readRecord(context, key));
            if (avatar != null && avatar.isFile() && !avatar.delete()) return false;
        }
        var preferences = context.getSharedPreferences("SecureStore", Context.MODE_PRIVATE);
        String record = RECORD_PREFIX + key;
        return !preferences.contains(record) || preferences.edit().remove(record).commit();
    }

    static Map<String, String> readReading(Context context, String owner, String chatId) {
        Map<String, String> fields = new HashMap<>();
        if (!isReadingScope(owner, chatId)) return fields;
        String recovery = readRecord(context, readingKey("recovery", owner, chatId));
        String pending = readRecord(context, readingKey("pending-ritual", owner, chatId));
        if (recovery != null) fields.put("recovery", recovery);
        if (pending != null) fields.put("pending", pending);
        return fields;
    }

    static boolean clearMemberReading(Context context, String owner, String chatId) {
        if (!isReadingScope(owner, chatId) || !owner.startsWith("member.")) return false;
        var preferences = context.getSharedPreferences("SecureStore", Context.MODE_PRIVATE);
        String recovery = readingKey("recovery", owner, chatId);
        String pending = readingKey("pending-ritual", owner, chatId);
        return preferences.edit()
            .remove(RECORD_PREFIX + recovery).remove(recovery)
            .remove(RECORD_PREFIX + pending).remove(pending)
            .commit();
    }

    private static boolean isReadingScope(String owner, String chatId) {
        return READING_OWNER.matcher(owner).matches() && READING_CHAT.matcher(chatId).matches();
    }

    private static String readingKey(String kind, String owner, String chatId) {
        return READING_PREFIX + kind + ".v2." + owner + "." + chatId;
    }

    private static File avatarFile(Context context, String value) {
        if (value == null) return null;
        try {
            File files = context.getFilesDir().getCanonicalFile();
            File directory = new File(files, "jovian-avatars");
            File avatar = new File(URI.create(value));
            String name = avatar.getName();
            if (!name.matches("[a-z0-9]+-[a-z0-9]*\\.[a-zA-Z0-9]{1,10}")) return null;
            File expected = new File(directory, name);
            return expected.equals(avatar.getCanonicalFile())
                    && expected.equals(expected.getCanonicalFile()) ? expected : null;
        } catch (IOException | IllegalArgumentException | SecurityException ignored) {
            return null;
        }
    }

    private static String readRecord(Context context, String preferenceKey) {
        try {
            String raw = context.getSharedPreferences("SecureStore", Context.MODE_PRIVATE)
                .getString(RECORD_PREFIX + preferenceKey, null);
            if (raw == null || raw.length() > 4096) return null;
            JSONObject record = new JSONObject(raw);
            if (!"aes".equals(record.optString("scheme"))
                    || !"key_v1".equals(record.optString("keystoreAlias"))
                    || !Boolean.TRUE.equals(record.opt("usesKeystoreSuffix"))
                    || !Boolean.FALSE.equals(record.opt("requireAuthentication"))) return null;

            KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
            keyStore.load(null);
            Key key = keyStore.getKey(ALIAS, null);
            if (!(key instanceof SecretKey)) return null;

            byte[] iv = Base64.decode(record.getString("iv"), Base64.DEFAULT);
            int tagBits = record.getInt("tlen");
            if (iv.length != 12 || tagBits < 96 || tagBits > 128 || tagBits % 8 != 0) return null;
            Cipher cipher = Cipher.getInstance(CIPHER);
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(tagBits, iv));
            byte[] ciphertext = Base64.decode(record.getString("ct"), Base64.DEFAULT);
            return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
        } catch (GeneralSecurityException | IOException | JSONException
                 | IllegalArgumentException | ClassCastException | SecurityException ignored) {
            return null;
        }
    }
}
