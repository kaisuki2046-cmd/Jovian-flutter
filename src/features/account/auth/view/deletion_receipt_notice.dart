import 'dart:async';

import 'package:material_ui/material_ui.dart';

import '../control/account_deletion_service.dart';
import '../model/account_deletion.dart';

class DeletionReceiptNotice extends StatefulWidget {
  const DeletionReceiptNotice({super.key, required this.service});

  final AccountDeletionService service;

  @override
  State<DeletionReceiptNotice> createState() => _DeletionReceiptNoticeState();
}

class _DeletionReceiptNoticeState extends State<DeletionReceiptNotice> {
  DeletionProgress? _receipt;
  bool _failed = false;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    unawaited(_refresh());
  }

  Future<void> _refresh() => _run(widget.service.refresh);

  Future<void> _dismiss() => _run(() async {
    await widget.service.dismiss();
    return null;
  });

  Future<void> _run(Future<DeletionProgress?> Function() action) async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _failed = false;
    });
    try {
      final receipt = await action();
      if (mounted) _receipt = receipt;
    } catch (_) {
      if (mounted) _failed = true;
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final receipt = _receipt;
    if (receipt == null && !_failed) return const SizedBox.shrink();
    final dismissible =
        !_failed &&
        receipt?.completed == true &&
        receipt?.deviceCleared == true;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (receipt != null)
              Text(receipt.completed ? '账号注销已完成。' : '账号已退出，关联数据正在清理。'),
            if (receipt?.deviceCleared == false) const Text('本机记录清理未完成，请重试。'),
            if (_failed) const Text('暂时无法读取或更新注销记录，请重试。'),
            TextButton(
              onPressed: _busy
                  ? null
                  : dismissible
                  ? _dismiss
                  : _refresh,
              child: Text(dismissible ? '知道了' : '刷新注销状态'),
            ),
          ],
        ),
      ),
    );
  }
}
