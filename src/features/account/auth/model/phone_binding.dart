enum BindingCodeTarget {
  current('bind-current'),
  next('bind');

  const BindingCodeTarget(this.path);

  final String path;
}

typedef BindingChallenge = ({String id, String phone, bool localInbox});

String maskAccountPhone(String phone) {
  final domestic = RegExp(r'^\+86(1\d{10})$').firstMatch(phone)?.group(1);
  final digits = domestic ?? phone.substring(1);
  return '${domestic == null ? '+' : ''}${digits.substring(0, 3)}'
      '${'*' * (digits.length - 5)}${digits.substring(digits.length - 2)}';
}
