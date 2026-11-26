import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../../../shared/http/json_client.dart';
import '../model/privacy_request.dart';
import '../requests/privacy_requests_api.dart';

class PrivacyRequestsController extends ChangeNotifier {
  PrivacyRequestsController(this._api) {
    unawaited(_load());
  }

  final PrivacyRequestsApi _api;
  final _cancel = Completer<void>();

  List<PrivacyReceipt>? receipts;
  String? next;
  String? notice;
  String? error;
  bool queue = false;
  bool canReview = false;
  bool loading = false;
  bool saving = false;
  bool get busy => loading || saving;

  Future<void> refresh() => busy ? Future.value() : _load();

  Future<void> more() {
    final cursor = next;
    return busy || cursor == null ? Future.value() : _load(cursor);
  }

  Future<void> showQueue(bool open) async {
    if (busy || queue == open || (open && !canReview)) return;
    queue = open;
    notice = null;
    receipts = null;
    next = null;
    await _load();
  }

  Future<void> _load([String? cursor]) async {
    loading = true;
    error = null;
    notifyListeners();
    try {
      final result = await _api.list(
        queue: queue,
        before: cursor,
        cancel: _cancel.future,
      );
      if (_cancel.isCompleted) return;
      if (!queue) canReview = result.canReview;
      final combined = <String, PrivacyReceipt>{
        if (cursor != null)
          for (final receipt in receipts ?? const <PrivacyReceipt>[])
            receipt.id: receipt,
        for (final receipt in result.receipts) receipt.id: receipt,
      };
      receipts = combined.values.toList();
      next = result.next;
    } catch (failure) {
      if (!_cancel.isCompleted) _showError(failure, '暂时无法加载申请，请重试。');
    } finally {
      loading = false;
      if (!_cancel.isCompleted) notifyListeners();
    }
  }

  Future<bool> submit(PrivacyRequestKind kind, String input) async {
    final detail = input.trim();
    if (queue || busy) return false;
    if (!_validate(detail, required: kind == PrivacyRequestKind.correction))
      return false;
    return _save(() async {
      final receipt = await _api.submit(kind, detail, cancel: _cancel.future);
      return receipt.detail == detail ? '申请已受理。可在本页查看进度。' : '已有同类申请待处理，请查看进度。';
    });
  }

  Future<bool> review(PrivacyReceipt receipt, String input) async {
    final conclusion = input.trim();
    if (!queue || !canReview || busy || receipt.ownerId == _api.owner)
      return false;
    if (!_validate(conclusion, required: true)) return false;
    return _save(() async {
      await _api.review(receipt.id, conclusion, cancel: _cancel.future);
      return '处理结果已保存。';
    });
  }

  bool _validate(String text, {required bool required}) {
    if (text.runes.length <= privacyRequestLimit &&
        (!required || text.isNotEmpty))
      return true;
    notice = null;
    error = text.isEmpty ? '请填写说明。' : '说明最多 $privacyRequestLimit 个字符。';
    notifyListeners();
    return false;
  }

  Future<bool> _save(Future<String> Function() action) async {
    saving = true;
    error = null;
    notice = null;
    notifyListeners();
    try {
      final message = await action();
      if (_cancel.isCompleted) return false;
      notice = message;
      await _load();
      return true;
    } catch (failure) {
      if (!_cancel.isCompleted) _showError(failure, '操作未完成，请重试。');
      return false;
    } finally {
      saving = false;
      if (!_cancel.isCompleted) notifyListeners();
    }
  }

  void _showError(Object failure, String fallback) {
    final status = failure is JsonRequestError ? failure.status : null;
    if (status == 401 || status == 403 || status == 428) {
      receipts = null;
      next = null;
      if (status == 403) canReview = false;
    }
    error = switch (status) {
      401 => '登录状态已变更，请重新登录后查看。',
      403 => '当前账户无权处理申请。',
      409 => '该申请已处理，请刷新。',
      428 => '请确认当前版本的用户协议后重试。',
      429 => '操作太频繁，请稍后重试。',
      _ => fallback,
    };
  }

  @override
  void dispose() {
    _cancel.complete();
    super.dispose();
  }
}
