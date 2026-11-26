part 'iching_data.dart';

enum ReadingDirection { advance, verify, adjust }

class Trigram {
  const Trigram(
    this.name,
    this.image,
    this.element,
    this.pattern,
    this.inner,
    this.outer,
  );

  final String name;
  final String image;
  final String element;
  final int pattern;
  final List<String> inner;
  final List<String> outer;

  Map<String, Object> toJson() => {
    'name': name,
    'image': image,
    'element': element,
    'pattern': pattern,
    'inner': inner,
    'outer': outer,
  };
}

class Hexagram {
  const Hexagram(
    this.name,
    this.upper,
    this.lower,
    this.pattern,
    this.theme,
    this.direction,
  );

  final String name;
  final Trigram upper;
  final Trigram lower;
  final int pattern;
  final String theme;
  final ReadingDirection direction;

  List<bool> get yangLines => List.generate(
    lineCount,
    (line) => pattern & (1 << line) != 0,
    growable: false,
  );

  Map<String, Object> toJson() => {
    'name': name,
    'upper': upper.name,
    'lower': lower.name,
    'yangLines': yangLines,
    'theme': theme,
    'direction': direction.name,
  };
}

const lineCount = 6;
const trigramMask = 7;
const _palaceMasks = [0, 1, 3, 7, 15, 31, 23, 16];
const _shiPositions = [6, 1, 2, 3, 4, 5, 4, 3];

typedef HexagramEntry = ({Hexagram hexagram, Trigram palace, int shi});

final _trigramsByPattern = {
  for (final trigram in trigrams) trigram.pattern: trigram,
};
final _hexagrams = _buildCatalogue();

Map<int, HexagramEntry> _buildCatalogue() {
  final catalogue = <int, HexagramEntry>{};
  for (final palace in trigrams) {
    final palacePattern = palace.pattern | (palace.pattern << 3);
    final entries = palaceHexagrams[palace.name]!;
    for (var index = 0; index < entries.length; index++) {
      final (name, direction, theme) = entries[index];
      final pattern = palacePattern ^ _palaceMasks[index];
      final upper = _trigramsByPattern[pattern >> 3]!;
      final lower = _trigramsByPattern[pattern & trigramMask]!;
      final title = upper == lower
          ? '$name为${upper.image}'
          : '${upper.image}${lower.image}$name';
      catalogue[pattern] = (
        hexagram: Hexagram(title, upper, lower, pattern, theme, direction),
        palace: palace,
        shi: _shiPositions[index],
      );
    }
  }
  return catalogue;
}

HexagramEntry lookupHexagramEntry(int pattern) =>
    _hexagrams[pattern] ?? (throw RangeError.range(pattern, 0, 63, 'pattern'));

Hexagram lookupHexagram(int pattern) => lookupHexagramEntry(pattern).hexagram;

Iterable<String> get hexagramNames =>
    _hexagrams.values.map((entry) => entry.hexagram.name);

enum ElementRelation { same, gives, controls, controlled, receives }

const _elements = ['木', '火', '土', '金', '水'];

ElementRelation elementRelation(String body, String other) {
  final distance =
      (_elements.indexOf(other) - _elements.indexOf(body)) % _elements.length;
  return ElementRelation.values[distance];
}
