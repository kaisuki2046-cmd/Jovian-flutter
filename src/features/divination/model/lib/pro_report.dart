const proMethods = ['tarot', 'meihua', 'liuyao'];
const _maxTextLength = 100000;

sealed class ProReport {
  const ProReport();

  Map<String, Object> toJson();
}

final class ProParagraph {
  const ProParagraph._(this.text, [this.detail]);

  final String text;
  final String? detail;

  Map<String, String> toJson() => {
    'text': text,
    if (detail case final detail?) 'detail': detail,
  };
}

final class ProParagraphReport extends ProReport {
  ProParagraphReport._(Map<String, List<ProParagraph>> sections)
    : sections = Map.unmodifiable(sections);

  final Map<String, List<ProParagraph>> sections;

  @override
  Map<String, Object> toJson() => {
    for (final method in proMethods)
      method: sections[method]!.map((part) => part.toJson()).toList(),
  };
}

final class ProTextReport extends ProReport {
  ProTextReport._(Map<String, String> sections)
    : sections = Map.unmodifiable(sections);

  final Map<String, String> sections;

  @override
  Map<String, Object> toJson() => {...sections};
}

typedef LegacyProSection = ({String text, String highlight});

final class LegacyProReport extends ProReport {
  LegacyProReport._(
    this.opening,
    this.closing,
    Map<String, LegacyProSection> sections,
  ) : sections = Map.unmodifiable(sections);

  final String opening;
  final String closing;
  final Map<String, LegacyProSection> sections;

  @override
  Map<String, Object> toJson() => {
    'opening': opening,
    for (final method in proMethods)
      method: {
        'text': sections[method]!.text,
        'highlight': sections[method]!.highlight,
      },
    'closing': closing,
  };
}

String _withoutMarkers(String text) => text.replaceAll('**', '');

ProReport parseProReport(Object? value, {bool allowLegacy = true}) {
  if (value is! Map || value.length != proMethods.length) {
    throw const FormatException('Invalid Pro report.');
  }
  final [tarot, meihua, liuyao] = proMethods.map((key) => value[key]).toList();
  if (allowLegacy && tarot is String && meihua is String && liuyao is String) {
    final sections = [tarot, meihua, liuyao];
    if (sections.any((text) => _withoutMarkers(text).trim().isEmpty)) {
      throw const FormatException('Invalid Pro report text.');
    }
    if (sections.fold(0, (length, text) => length + text.runes.length) >
        _maxTextLength) {
      throw const FormatException('Pro report exceeds length limit.');
    }
    return ProTextReport._(Map.fromIterables(proMethods, sections));
  }
  if (tarot is! List ||
      meihua is! List ||
      liuyao is! List ||
      tarot.length != 4 ||
      meihua.length < 3 ||
      meihua.length > 4 ||
      liuyao.length < 3 ||
      liuyao.length > 4) {
    throw const FormatException('Invalid Pro report sections.');
  }
  final sections = [tarot, meihua, liuyao];
  return ProParagraphReport._({
    for (var index = 0; index < proMethods.length; index++)
      proMethods[index]: List.unmodifiable(
        sections[index].indexed.map(
          (entry) => _parseParagraph(
            entry.$2,
            overview: entry.$1 == sections[index].length - 1,
            allowLegacy: allowLegacy,
          ),
        ),
      ),
  });
}

ProParagraph _parseParagraph(
  Object? value, {
  required bool overview,
  required bool allowLegacy,
}) {
  if (value is! Map)
    throw const FormatException('Invalid Pro report paragraph.');
  final text = value['text'];
  if (text is! String ||
      _withoutMarkers(text).trim().isEmpty ||
      text.length > 240) {
    throw const FormatException('Invalid Pro report paragraph text.');
  }
  final detail = value['detail'];
  final technique = value['technique'];
  final interpretation = value['interpretation'];
  final legacy =
      allowLegacy &&
      value.length == 3 &&
      technique is String &&
      technique.trim().isNotEmpty &&
      technique.length <= 240 &&
      interpretation is String &&
      interpretation.trim().isNotEmpty &&
      interpretation.length <= 240;
  if (overview && (value.length == 1 || legacy)) {
    return ProParagraph._(text.trim().replaceFirst(RegExp(r'^小结'), '综述'));
  }
  if (!overview &&
      value.length == 2 &&
      detail is String &&
      detail.trim().isNotEmpty &&
      detail.length <= 480) {
    return ProParagraph._(text.trim(), detail.trim());
  }
  if (!overview && legacy) {
    return ProParagraph._(
      text.trim(),
      '${technique.trim()} ${interpretation.trim()}',
    );
  }
  throw const FormatException('Invalid Pro report paragraph detail.');
}

ProReport parseSavedProReport(Object? value) {
  if (value is! Map || !value.containsKey('opening'))
    return parseProReport(value);
  if (value.length != 5)
    throw const FormatException('Invalid legacy Pro report.');

  String readText(Object? field) {
    if (field is! String || field.trim().isEmpty) {
      throw const FormatException('Invalid Pro report text.');
    }
    return field;
  }

  final opening = readText(value['opening']);
  final closing = readText(value['closing']);
  final sections = <String, LegacyProSection>{};
  var length = opening.length + closing.length;
  for (final method in proMethods) {
    final field = value[method];
    if (field is! Map || field.length != 2) {
      throw const FormatException('Invalid legacy Pro section.');
    }
    final text = readText(field['text']);
    final highlight = field['highlight'];
    final phrase = highlight is String ? highlight.trim() : '';
    sections[method] = (
      text: text,
      highlight: phrase.runes.length <= 20 && highlightOffset(text, phrase) >= 0
          ? phrase
          : '',
    );
    length += text.length;
  }
  if (length > _maxTextLength)
    throw const FormatException('Pro report exceeds length limit.');
  return LegacyProReport._(opening, closing, sections);
}

final _endPunctuation = RegExp(r'[\s。！？!?；;”’」』）》]+$');
final _startQuotes = RegExp(r'^[“‘「『]+');
final _phrasePunctuation = RegExp(r'[。！？!?；;]');

int highlightOffset(String text, String highlight) {
  if (highlight.isEmpty || RegExp(r'[。！？!?；;\r\n]').hasMatch(highlight))
    return -1;
  final last = text.replaceFirst(_endPunctuation, '');
  var start = 0;
  for (final separator in ['。', '！', '？', '!', '?', '\n']) {
    final boundary = last.lastIndexOf(separator) + 1;
    if (boundary > start) start = boundary;
  }
  final sentence = last.substring(start).trim();
  if (sentence == highlight ||
      sentence.replaceFirst(_startQuotes, '') == highlight)
    return -1;
  final index = last.lastIndexOf(highlight);
  return index >= start ? index : -1;
}

typedef ProTextPart = ({String text, bool bold});

final _markedPhrase = RegExp(r'\*\*([^*\r\n]+)\*\*');
final _previousSentence = RegExp(r'[。！？!?\r\n]\s*$');
final _nextSentence = RegExp(r'^\s*[。！？!?\r\n]');

List<ProTextPart> splitProText(String text) {
  final parts = <String>[];
  var offset = 0;
  for (final match in _markedPhrase.allMatches(text)) {
    parts
      ..add(text.substring(offset, match.start))
      ..add(match.group(1)!);
    offset = match.end;
  }
  parts.add(text.substring(offset));

  return [
    for (final (index, part) in parts.indexed)
      if (_withoutMarkers(part).isNotEmpty)
        (
          text: _withoutMarkers(part),
          bold: index.isOdd && _isBoldPhrase(parts, index),
        ),
  ];
}

bool _isBoldPhrase(List<String> parts, int index) {
  final part = parts[index];
  final phrase = part.trim();
  final previous = parts[index - 1];
  final next = parts[index + 1];
  final atStart =
      (index == 1 && previous.trim().isEmpty) ||
      _previousSentence.hasMatch(previous);
  final atEnd =
      (index == parts.length - 2 && next.trim().isEmpty) ||
      _nextSentence.hasMatch(next);
  return phrase.isNotEmpty &&
      phrase.runes.length <= 20 &&
      !_phrasePunctuation.hasMatch(part) &&
      !(atStart && atEnd);
}

final _evidenceEnd = RegExp(r'[。！？!?；;]\s*(?=[^。！？!?；;\s])');
final _interpretationStart = RegExp(r'(?:提示|意味着|说明|显示|暗示|表明|[，,])\s*');
final _lastSentenceMark = RegExp(r'[。！？!?；;]+$');

List<ProTextPart> splitProInterpretation(String text) {
  final parts = splitProText(text);
  if (parts.any((part) => part.bold)) return parts;
  final plain = parts.map((part) => part.text).join();
  final boundary =
      _evidenceEnd.firstMatch(plain) ?? _interpretationStart.firstMatch(plain);
  final start = boundary?.end ?? 0;
  final end = plain.trimRight().replaceFirst(_lastSentenceMark, '').length;
  if (end <= start) return parts;
  return [
    if (start > 0) (text: plain.substring(0, start), bold: false),
    (text: plain.substring(start, end), bold: true),
    if (end < plain.length) (text: plain.substring(end), bold: false),
  ];
}
