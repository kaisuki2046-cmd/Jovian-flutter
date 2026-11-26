final _packageName = RegExp(r'^[A-Za-z]\w*(?:\.[A-Za-z]\w*)+$');

class AndroidAppVersion {
  const AndroidAppVersion(
    this.applicationId,
    this.versionCode,
    this.versionName,
  );

  final String applicationId;
  final int versionCode;
  final String versionName;

  factory AndroidAppVersion.fromJson(Map<Object?, Object?>? value) {
    if (value
        case {
          'applicationId': final String applicationId,
          'versionCode': final int versionCode,
          'versionName': final String versionName,
        }
        when _packageName.hasMatch(applicationId) &&
            versionCode > 0 &&
            versionCode <= 9007199254740991 &&
            versionName.trim().isNotEmpty &&
            versionName.length <= 64) {
      return AndroidAppVersion(applicationId, versionCode, versionName.trim());
    }
    throw const FormatException('Invalid Android version.');
  }
}

class AndroidRelease {
  const AndroidRelease(this.version, this.notes, this.downloadUrl);

  final AndroidAppVersion version;
  final List<String> notes;
  final Uri downloadUrl;

  static String? trustedDownloadOrigin(String input) {
    final url = Uri.tryParse(input.trim());
    if (url == null ||
        url.scheme != 'https' ||
        url.host.isEmpty ||
        url.userInfo.isNotEmpty ||
        url.authority.contains('@') ||
        (url.path.isNotEmpty && url.path != '/') ||
        url.hasQuery ||
        url.hasFragment) {
      return null;
    }
    return url.origin;
  }

  static AndroidRelease? fromResponse(
    Map<String, Object?> response,
    String origin,
  ) {
    if (response case {'release': null}) return null;
    if (response case {'release': final Map<String, Object?> release}) {
      final version = AndroidAppVersion.fromJson(release);
      final notes = release['notes'];
      final link = release['downloadUrl'];
      if (notes is List<Object?> &&
          notes.isNotEmpty &&
          notes.length <= 12 &&
          notes.every(
            (item) =>
                item is String && item.trim().isNotEmpty && item.length <= 400,
          ) &&
          link is String &&
          link.length <= 2048) {
        final url = Uri.tryParse(link);
        if (url != null &&
            url.scheme == 'https' &&
            url.host.isNotEmpty &&
            url.userInfo.isEmpty &&
            !url.authority.contains('@') &&
            url.origin == origin) {
          return AndroidRelease(
            version,
            List.unmodifiable(notes.cast<String>().map((note) => note.trim())),
            url,
          );
        }
      }
    }
    throw const FormatException('Invalid Android release.');
  }
}
