import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../../../shared/http/json_client.dart';
import '../model/report_history.dart';
import '../requests/report_history_api.dart';

class ReportHistoryController extends ChangeNotifier {
  ReportHistoryController(
    this._api,
    this.owner,
    this.kind,
    this._reloadAccount,
  ) {
    unawaited(refresh());
  }

  final ReportHistoryApi _api;
  final String owner;
  final ReportKind kind;
  final Future<void> Function() _reloadAccount;
  ReportHistoryPage? page;
  ArchivedReport? report;
  String? listError;
  String? detailError;
  String? selected;
  bool loading = true;
  bool locked = false;
  bool _closed = false;
  int _pageRevision = 0;
  int _detailRevision = 0;

  Future<void> refresh() async {
    _detailRevision++;
    selected = null;
    report = null;
    detailError = null;
    page = null;
    await _readPage();
  }

  Future<void> more() async {
    final cursor = page?.nextCursor;
    if (loading || cursor == null) return;
    await _readPage(cursor);
  }

  Future<void> _readPage([String? cursor]) async {
    final revision = ++_pageRevision;
    locked = false;
    loading = true;
    listError = null;
    notifyListeners();
    try {
      final result = await _api.list(owner, kind, before: cursor);
      if (_closed || revision != _pageRevision) return;
      page = ReportHistoryPage([
        ...?page?.entries,
        ...result.entries,
      ], result.nextCursor);
    } catch (error) {
      if (_closed || revision != _pageRevision) return;
      listError = '暂时无法读取报告列表。';
      _checkIdentity(error);
    } finally {
      if (!_closed && revision == _pageRevision) {
        loading = false;
        notifyListeners();
      }
    }
  }

  Future<void> select(String id) async {
    final revision = ++_detailRevision;
    selected = id;
    report = null;
    detailError = null;
    notifyListeners();
    try {
      final current = await _api.detail(owner, kind, id);
      if (_closed || revision != _detailRevision) return;
      report = current;
    } catch (error) {
      if (_closed || revision != _detailRevision) return;
      detailError = '暂时无法读取这份报告。';
      _checkIdentity(error);
    } finally {
      if (!_closed && revision == _detailRevision) notifyListeners();
    }
  }

  void _checkIdentity(Object error) {
    if (error is JsonRequestError &&
        (error.status == 401 || error.status == 403)) {
      locked = true;
      page = null;
      report = null;
      selected = null;
      loading = false;
      _pageRevision++;
      _detailRevision++;
      // Account restore can change the owner, which disposes this controller.
      notifyListeners();
      unawaited(_reloadAccount());
    }
  }

  @override
  void dispose() {
    _closed = true;
    super.dispose();
  }
}
