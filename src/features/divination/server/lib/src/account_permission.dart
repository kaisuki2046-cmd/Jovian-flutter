import 'dart:convert';
import 'dart:io';

import 'package:jovian_divination/jovian_divination.dart';

import 'reading_store.dart';

const _purpose = 'divination.cloud_assistance';
final _accountToken = RegExp(r'^[A-Za-z0-9_-]{43}$');
final _accountId = RegExp(r'^[0-9a-f-]{36}$');

class ReadingAccess {
  const ReadingAccess({required this.owner, required this.allowed});

  final ReadingOwner owner;
  final bool allowed;

  Future<void> requirePermission() async {
    if (!allowed) throw const GuideRitualError(428, 'ai_permission_required');
  }
}

class AccountPermissionReader {
  AccountPermissionReader(
    Uri accountBase, {
    this.timeout = const Duration(seconds: 4),
  }) : _permission = accountBase
           .resolve('/account/agreements/permission')
           .replace(queryParameters: const {'purpose': _purpose});

  final Uri _permission;
  final Duration timeout;

  Future<ReadingAccess> read(HttpHeaders incoming) async {
    final headers = _credentials(incoming);
    final client = HttpClient()..connectionTimeout = timeout;
    try {
      return await (() async {
        final request = await client.getUrl(_permission);
        request.followRedirects = false;
        headers.forEach(request.headers.set);
        final response = await request.close();
        if (response.statusCode == HttpStatus.unauthorized) {
          throw const GuideRitualError(401, 'account_session_required');
        }
        if (response.statusCode < 200 || response.statusCode >= 300) {
          throw const GuideRitualError(503, 'account_permission_unavailable');
        }
        return _parse(jsonDecode(await utf8.decoder.bind(response).join()));
      })().timeout(timeout);
    } on GuideRitualError {
      rethrow;
    } catch (_) {
      throw const GuideRitualError(503, 'account_permission_unavailable');
    } finally {
      client.close(force: true);
    }
  }
}

Map<String, String> _credentials(HttpHeaders incoming) {
  final origins = incoming['Origin'] ?? const [];
  final cookies = incoming[HttpHeaders.cookieHeader]?.join('; ') ?? '';
  if (origins.length == 1 && origins.single.isNotEmpty && cookies.isNotEmpty) {
    return {'Origin': origins.single, 'Cookie': cookies};
  }
  final sessions = incoming['X-Account-Session'] ?? const [];
  if (origins.isEmpty &&
      sessions.length == 1 &&
      _accountToken.hasMatch(sessions.single)) {
    return {
      'X-App-Client': 'native',
      'Authorization': 'Bearer ${sessions.single}',
    };
  }
  throw const GuideRitualError(401, 'account_session_required');
}

ReadingAccess _parse(Object? decoded) {
  const invalid = GuideRitualError(503, 'account_permission_unavailable');
  if (decoded is! Map ||
      decoded['allowed'] is! bool ||
      decoded['identity'] is! Map) {
    throw invalid;
  }
  final identity = decoded['identity'] as Map;
  final id = identity['id'];
  if (id is! String || !_accountId.hasMatch(id)) throw invalid;
  final kind = switch (identity['kind']) {
    'member' => ReadingOwnerKind.member,
    'guest' => ReadingOwnerKind.guest,
    _ => throw invalid,
  };
  return ReadingAccess(
    owner: ReadingOwner(kind, id),
    allowed: decoded['allowed'] as bool,
  );
}
