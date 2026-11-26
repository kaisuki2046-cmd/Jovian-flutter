import '../../../shared/http/json_client.dart';

class DestinyReportApi {
  const DestinyReportApi(this.http, {this.readNativeSession});

  final JsonHttpClient http;
  final Future<String?> Function()? readNativeSession;

  Future<String> read(Map<String, Object?> request) async {
    final token = await readNativeSession?.call();
    final response = await http.request(
      ['destiny', 'report'],
      body: request,
      headers: {if (token != null) 'X-Account-Session': token},
    );
    final report = response['report'];
    if (report is! String || report.trim().isEmpty) {
      throw const FormatException('解读服务未生成报告，请重试。');
    }
    return report.trim();
  }
}
