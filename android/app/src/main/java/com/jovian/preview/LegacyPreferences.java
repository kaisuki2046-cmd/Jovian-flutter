package com.jovian.preview;

import android.content.Context;
import android.util.Base64;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.Key;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONException;
import org.json.JSONObject;

/** Reads the device preferences written by this app's Expo SecureStore 58 client. */
final class LegacyPreferences {
    private static final String RECORD = "key_v1-jovian.preferences.v1";
    private static final String CIPHER = "AES/GCM/NoPadding";
    private static final String ALIAS = CIPHER + ":key_v1:keystoreUnauthenticated";

    private LegacyPreferences() {}

    static String read(Context context) {
        try {
            String raw = context.getSharedPreferences("SecureStore", Context.MODE_PRIVATE)
                .getString(RECORD, null);
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
