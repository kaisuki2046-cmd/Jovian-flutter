package com.jovian.preview;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Intent;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import android.webkit.MimeTypeMap;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/** Read-only access to the one local file granted to the chosen viewer. */
public final class AttachmentPreviewProvider extends ContentProvider {
    private static final String AUTHORITY_SUFFIX = ".attachment_preview";
    private static final Pattern PICKER_DIRECTORY = Pattern.compile(
        "[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}");
    private static final String UNKNOWN_TYPE = "application/octet-stream";
    private static final String[] FILE_COLUMNS = {
        OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE
    };

    static boolean open(Activity activity, String path, String mimeType) {
        if (path == null || !new File(path).isAbsolute()) return false;
        try {
            File file = pickedFile(activity.getCacheDir(), new File(path));
            if (file == null) return false;
            Uri uri = new Uri.Builder()
                .scheme("content")
                .authority(activity.getPackageName() + AUTHORITY_SUFFIX)
                .appendPath(file.getParentFile().getName())
                .appendPath(file.getName())
                .build();
            Intent intent = new Intent(Intent.ACTION_VIEW)
                .setDataAndType(uri, previewType(file.getName(), mimeType))
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.setClipData(ClipData.newRawUri(file.getName(), uri));
            activity.startActivity(intent);
            return true;
        } catch (IOException | ActivityNotFoundException | SecurityException
                 | IllegalArgumentException error) {
            return false;
        }
    }

    // file_selector_android stages each document in cache/<uuid>/<display name>.
    static File pickedFile(File cacheDirectory, File requested) throws IOException {
        File cache = cacheDirectory.getCanonicalFile();
        File file = requested.getCanonicalFile();
        File directory = file.getParentFile();
        if (directory == null || !cache.equals(directory.getParentFile())
                || !PICKER_DIRECTORY.matcher(directory.getName()).matches()
                || !file.isFile() || !file.canRead()) {
            return null;
        }
        return file;
    }

    private static String previewType(String name, String supplied) {
        if (supplied != null && !supplied.isEmpty() && !UNKNOWN_TYPE.equals(supplied)) {
            return supplied;
        }
        int extensionStart = name.lastIndexOf('.') + 1;
        String detected = extensionStart == 0 ? null : MimeTypeMap.getSingleton()
            .getMimeTypeFromExtension(name.substring(extensionStart).toLowerCase(Locale.ROOT));
        return detected == null ? UNKNOWN_TYPE : detected;
    }

    private File fileForUri(Uri uri) throws FileNotFoundException {
        List<String> segments = uri.getPathSegments();
        if (segments.size() != 2 || !PICKER_DIRECTORY.matcher(segments.get(0)).matches()) {
            throw new FileNotFoundException();
        }
        String name = segments.get(1);
        if (name.indexOf('/') >= 0 || name.equals(".") || name.equals("..")) {
            throw new FileNotFoundException();
        }
        File cache = getContext().getCacheDir();
        try {
            File file = pickedFile(cache, new File(new File(cache, segments.get(0)), name));
            if (file != null && file.getParentFile().getName().equals(segments.get(0))
                    && file.getName().equals(name)) {
                return file;
            }
        } catch (IOException | SecurityException error) {
            throw new FileNotFoundException();
        }
        throw new FileNotFoundException();
    }

    @Override
    public boolean onCreate() {
        return true;
    }

    @Override
    public String getType(Uri uri) {
        String name = uri.getLastPathSegment();
        return name == null ? UNKNOWN_TYPE : previewType(name, null);
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection,
                        String[] selectionArgs, String sortOrder) {
        String[] columns = projection == null ? FILE_COLUMNS : projection;
        MatrixCursor cursor = new MatrixCursor(columns, 1);
        try {
            File file = fileForUri(uri);
            Object[] row = new Object[columns.length];
            for (int index = 0; index < columns.length; index++) {
                switch (columns[index]) {
                    case OpenableColumns.DISPLAY_NAME:
                        row[index] = file.getName();
                        break;
                    case OpenableColumns.SIZE:
                        row[index] = file.length();
                        break;
                    default:
                        break;
                }
            }
            cursor.addRow(row);
        } catch (FileNotFoundException error) {
            // The cache may have been cleared since the file was selected.
        }
        return cursor;
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        if (!"r".equals(mode)) throw new FileNotFoundException();
        return ParcelFileDescriptor.open(fileForUri(uri), ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) {
        throw new UnsupportedOperationException();
    }

    @Override
    public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) {
        throw new UnsupportedOperationException();
    }

    @Override
    public int delete(Uri uri, String selection, String[] selectionArgs) {
        throw new UnsupportedOperationException();
    }
}
