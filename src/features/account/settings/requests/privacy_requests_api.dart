import '../../auth/requests/account_api.dart';
import '../model/privacy_request.dart';

class PrivacyRequestsApi {
  const PrivacyRequestsApi(this._account, this.owner, this._isCurrent);

  final AccountApi _account;
  final String owner;
  final bool Function() _isCurrent;

  Future<PrivacyRequestPage> list({
    required bool queue,
    String? before,
    Future<void>? cancel,
  }) async {
    final response = await _account.readAsMember(
      ['privacy-requests', if (queue) 'review'],
      owner,
      isCurrent: _isCurrent,
      query: before == null ? null : {'before': before},
      cancel: cancel,
    );
    final items = response['items'];
    final next = response['next'];
    if (items is! List || (next != null && next is! String)) {
      throw const FormatException('Invalid privacy request page.');
    }
    return (
      receipts: items
          .map((item) => PrivacyReceipt.fromJson(item, queue: queue))
          .toList(),
      next: next as String?,
      canReview: response['canReview'] == true,
    );
  }

  Future<PrivacyReceipt> submit(
    PrivacyRequestKind kind,
    String detail, {
    Future<void>? cancel,
  }) async => PrivacyReceipt.fromJson(
    await _account.writeAsMember(
      ['privacy-requests'],
      owner,
      body: {'kind': kind.wireValue, 'detail': detail},
      isCurrent: _isCurrent,
      cancel: cancel,
    ),
  );

  Future<PrivacyReceipt> review(
    String id,
    String conclusion, {
    Future<void>? cancel,
  }) async => PrivacyReceipt.fromJson(
    await _account.writeAsMember(
      ['privacy-requests', 'review'],
      owner,
      body: {'id': id, 'conclusion': conclusion},
      isCurrent: _isCurrent,
      cancel: cancel,
    ),
  );
}
