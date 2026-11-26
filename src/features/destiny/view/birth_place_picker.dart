import 'package:jovian_destiny/jovian_destiny.dart' show BirthPlace;
import 'package:material_ui/material_ui.dart';

import '../../../ui/interface_language.dart';

Future<BirthPlace?> pickBirthPlace(
  BuildContext context,
  List<BirthPlace> places,
  BirthPlace? current,
) => showDialog<BirthPlace>(
  context: context,
  builder: (_) => _BirthPlacePicker(places: places, current: current),
);

String birthPlaceSearchKey(String value) =>
    value.replaceAll(RegExp(r'[\s·・/／,，]+'), '').toLowerCase();

bool birthPlaceMatches(BirthPlace place, String query) =>
    birthPlaceSearchKey(place.name).contains(query) ||
    place.adminCode?.toLowerCase() == query;

class _BirthPlacePicker extends StatefulWidget {
  const _BirthPlacePicker({required this.places, required this.current});

  final List<BirthPlace> places;
  final BirthPlace? current;

  @override
  State<_BirthPlacePicker> createState() => _BirthPlacePickerState();
}

class _BirthPlacePickerState extends State<_BirthPlacePicker> {
  static const _labels = ['选择国家或地区', '选择省或州', '选择城市', '选择城市或区县'];
  late final List<String> _path = [
    if (widget.current case final current?) ...[
      current.country,
      current.region,
      current.city,
    ],
  ];
  late BirthPlace? _selected = widget.current;
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final search = birthPlaceSearchKey(_query);
    final depth = _path.length;
    final searching = search.isNotEmpty;
    final places = searching
        ? widget.places
              .where((place) => birthPlaceMatches(place, search))
              .take(40)
              .toList()
        : widget.places.where((place) {
            final divisions = _divisions(place);
            for (var level = 0; level < depth; level++) {
              if (divisions[level] != _path[level]) return false;
            }
            return true;
          }).toList();
    final browseOptions = !searching && depth < 3
        ? places.map((place) => _divisions(place)[depth]).toSet().toList()
        : const <String>[];
    final list = browseOptions.isNotEmpty
        ? [
            for (final name in browseOptions)
              ListTile(
                title: Text(name),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => setState(() {
                  _path.add(name);
                  _selected = null;
                }),
              ),
          ]
        : [
            for (final place in places)
              ListTile(
                title: Text(
                  searching ? place.name : place.district ?? place.city,
                ),
                selected: _selected?.id == place.id,
                trailing: _selected?.id == place.id
                    ? const Icon(Icons.check)
                    : null,
                onTap: () => setState(() => _selected = place),
              ),
          ];
    return Dialog(
      alignment: Alignment.bottomCenter,
      insetPadding: const EdgeInsets.fromLTRB(12, 12, 12, 16),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 460),
        child: SizedBox(
          height: 480,
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Semantics(
                  header: true,
                  child: UiText(
                    '选择出生地点',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  decoration: InputDecoration(
                    labelText: context.uiLabel('搜索城市或区县'),
                    prefixIcon: const Icon(Icons.search),
                  ),
                  onChanged: (value) => setState(() => _query = value),
                ),
                const SizedBox(height: 8),
                if (!searching && _path.isNotEmpty)
                  Align(
                    alignment: AlignmentDirectional.centerStart,
                    child: TextButton.icon(
                      icon: const Icon(Icons.arrow_back),
                      label: Text(
                        _path.join(' · '),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      onPressed: () => setState(() {
                        _path.removeLast();
                        _selected = null;
                      }),
                    ),
                  ),
                if (!searching) UiText(_labels[depth]),
                Expanded(
                  child: list.isEmpty
                      ? const Center(child: UiText('目录中没有匹配的地点。'))
                      : ListView(
                          key: ValueKey((searching, depth)),
                          keyboardDismissBehavior:
                              ScrollViewKeyboardDismissBehavior.onDrag,
                          children: list,
                        ),
                ),
                if (_selected case final selected?)
                  Text(
                    selected.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                Wrap(
                  alignment: WrapAlignment.end,
                  spacing: 8,
                  children: [
                    TextButton(
                      onPressed: () => Navigator.pop(context),
                      child: const UiText('取消'),
                    ),
                    FilledButton(
                      onPressed: _selected == null
                          ? null
                          : () => Navigator.pop(context, _selected),
                      child: const UiText('确认'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  static List<String> _divisions(BirthPlace place) => [
    place.country,
    place.region,
    place.city,
  ];
}
