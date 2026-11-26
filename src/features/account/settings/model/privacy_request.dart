enum PrivacyRequestKind {
  accessCopy('access_copy', '查阅或复制申请'),
  correction('correction', '更正申请');

  const PrivacyRequestKind(this.wireValue, this.label);

  final String wireValue;
  final String label;
}

const privacyRequestLimit = 600;

class PrivacyReceipt {
  const PrivacyReceipt({
    required this.id,
    required this.kind,
    required this.detail,
    required this.createdAt,
    required this.reviewed,
    this.conclusion,
    this.ownerId,
  });

  final String id;
  final PrivacyRequestKind kind;
  final String detail;
  final DateTime createdAt;
  final bool reviewed;
  final String? conclusion;
  final String? ownerId;

  factory PrivacyReceipt.fromJson(Object? value, {bool queue = false}) {
    if (value case {
      'id': final String id,
      'kind': final String kind,
      'detail': final String detail,
      'createdAt': final int createdAt,
      'reviewedAt': final int? reviewedAt,
      'conclusion': final String? conclusion,
    }) {
      final parsed = PrivacyRequestKind.values
          .where((option) => option.wireValue == kind)
          .firstOrNull;
      final owner = value['ownerId'];
      if (parsed != null && (!queue || owner is String)) {
        return PrivacyReceipt(
          id: id,
          kind: parsed,
          detail: detail,
          createdAt: DateTime.fromMillisecondsSinceEpoch(createdAt),
          reviewed: reviewedAt != null,
          conclusion: conclusion,
          ownerId: queue ? owner as String : null,
        );
      }
    }
    throw const FormatException('Invalid privacy request receipt.');
  }
}

typedef PrivacyRequestPage = ({
  List<PrivacyReceipt> receipts,
  String? next,
  bool canReview,
});
