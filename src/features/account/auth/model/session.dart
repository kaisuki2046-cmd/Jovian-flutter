enum AccountKind { member, guest }

class AccountSession {
  const AccountSession.member({
    required this.id,
    required this.displayName,
    this.uid,
    this.email,
    this.bio = '',
    this.namePublic = false,
    this.bioPublic = false,
    this.hasPassword = false,
    this.socialProvider,
  }) : kind = AccountKind.member;

  const AccountSession.guest(this.id)
    : kind = AccountKind.guest,
      displayName = '游客',
      uid = null,
      email = null,
      bio = '',
      namePublic = false,
      bioPublic = false,
      hasPassword = false,
      socialProvider = null;

  final AccountKind kind;
  final String id;
  final String displayName;
  final String? uid;
  final String? email;
  final String bio;
  final bool namePublic;
  final bool bioPublic;
  final bool hasPassword;
  final String? socialProvider;

  String get scope => '${kind.name}:$id';

  factory AccountSession.fromMember(Map<String, Object?> response) {
    final user = response['user'];
    if (user case {
      'id': final String id,
      'displayName': final String name,
    } when id.isNotEmpty) {
      final uid = user['uid'];
      final visibility = user['visibility'];
      final password = user['hasPassword'];
      final provider = user['socialProvider'];
      return AccountSession.member(
        id: id,
        displayName: name,
        email: user['email'] is String ? user['email'] as String : null,
        uid: uid is String && RegExp(r'^[1-9]\d{7}$').hasMatch(uid)
            ? uid
            : null,
        bio: (user['bio'] as String?) ?? '',
        namePublic: visibility is Map && visibility['displayName'] == true,
        bioPublic: visibility is Map && visibility['bio'] == true,
        hasPassword: password is bool ? password : user['email'] is String,
        socialProvider:
            provider is String && ['wechat', 'qq'].contains(provider)
            ? provider
            : null,
      );
    }
    throw const FormatException('Invalid account profile.');
  }

  factory AccountSession.fromGuest(Map<String, Object?> response) {
    final id = response['id'];
    if (id is String && id.isNotEmpty && response['expiresAt'] is num) {
      return AccountSession.guest(id);
    }
    throw const FormatException('Invalid guest session.');
  }
}

abstract interface class NativeSessionStorage {
  Future<String?> read();
  Future<void> write(String? token);
}

enum AuthMethod { password, register, phoneCode, guest, wechat, qq }

class AccountIdentifier {
  const AccountIdentifier._(this.field, this.value);

  final String field;
  final String value;

  bool get isPhone => field == 'phone';

  static AccountIdentifier? parse(String input) {
    final email = input.trim().toLowerCase();
    if (email.length <= 254 &&
        RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email)) {
      return AccountIdentifier._('email', email);
    }
    if (input.length > 32) return null;
    final phone = input.trim().replaceAll(RegExp(r'[ ()-]'), '');
    if (RegExp(r'^1[3-9]\d{9}$').hasMatch(phone)) {
      return AccountIdentifier._('phone', '+86$phone');
    }
    if (RegExp(r'^\+[1-9]\d{7,14}$').hasMatch(phone)) {
      return AccountIdentifier._('phone', phone);
    }
    return null;
  }
}

class AuthCapabilities {
  AuthCapabilities.fromJson(Map<String, Object?> response)
    : emailRegistrationCodeRequired =
          response['emailRegistrationCodeRequired'] != false,
      phoneRegistrationWithoutCode =
          response['phoneRegistrationWithoutCode'] == true,
      emailRegistrationAvailable =
          response['emailRegistrationAvailable'] == true,
      phoneCodesAvailable = response['phoneCodesAvailable'] == true,
      localSocialProviders = response['localSocialProviders'] is List
          ? response['localSocialProviders'] as List
          : const [];

  final bool emailRegistrationCodeRequired;
  final bool phoneRegistrationWithoutCode;
  final bool emailRegistrationAvailable;
  final bool phoneCodesAvailable;
  final List<Object?> localSocialProviders;
}
