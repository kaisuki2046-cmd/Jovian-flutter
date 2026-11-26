import '../../../shared/http/json_client.dart';

class DestinyReportApi {
  const DestinyReportApi(this.http, {this.readNativeSession});

  final JsonHttpClient http;
  final Future<String?> Function()? readNativeSession;

  Future<String> read(
    Map<String, Object?> request, {
    Future<void>? cancel,
  }) async {
    final token = await readNativeSession?.call();
    final response = await http.request(
      ['destiny', 'report'],
      body: request,
      headers: {if (token != null) 'X-Account-Session': token},
      cancel: cancel,
    );
    final report = response['report'];
    if (response.containsKey('report') && report == null) {
      throw const FormatException('本次盘面未匹配到可用于解读的规则。');
    }
    if (report is! String || report.trim().isEmpty) {
      throw const FormatException('解读服务未生成报告，请重试。');
    }
    return report.trim();
  }
}
