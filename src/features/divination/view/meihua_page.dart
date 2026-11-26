import 'package:flutter/services.dart';
import 'package:jovian_divination/jovian_divination.dart';
import 'package:material_ui/material_ui.dart';

import 'cast_content.dart';
import 'hexagram_card.dart';

class MeihuaForm extends StatefulWidget {
  const MeihuaForm({super.key});

  @override
  State<MeihuaForm> createState() => _MeihuaFormState();
}

class _MeihuaFormState extends State<MeihuaForm>
    with AutomaticKeepAliveClientMixin {
  static const _labels = ['第一个数（上卦）', '第二个数（下卦）', '第三个数（参与取动爻）'];
  final _form = GlobalKey<FormState>();
  final _fields = List.generate(_labels.length, (_) => TextEditingController());
  MeihuaReading? _reading;

  @override
  bool get wantKeepAlive => true;

  @override
  void dispose() {
    for (final field in _fields) {
      field.dispose();
    }
    super.dispose();
  }

  String? _validateNumber(String? value) {
    final number = int.tryParse(value ?? '');
    return number != null && number >= 1 && number <= 999
        ? null
        : '请输入 1 到 999 的整数';
  }

  void _cast() {
    if (!_form.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    final reading = readMeihuaNumbers(
      _fields.map((field) => int.parse(field.text)).toList(),
    );
    setState(() => _reading = reading);
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final theme = Theme.of(context);
    return CastContent(
      children: [
        Text('梅花报数', style: theme.textTheme.headlineMedium),
        const SizedBox(height: 8),
        const Text('输入三个 1 到 999 的整数。本次起卦只使用这三个数。'),
        const SizedBox(height: 20),
        Form(
          key: _form,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (var index = 0; index < _fields.length; index++)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: TextFormField(
                    controller: _fields[index],
                    decoration: InputDecoration(
                      labelText: _labels[index],
                      border: const OutlineInputBorder(),
                    ),
                    keyboardType: TextInputType.number,
                    textInputAction: index == _fields.length - 1
                        ? TextInputAction.done
                        : TextInputAction.next,
                    inputFormatters: [
                      FilteringTextInputFormatter.digitsOnly,
                      LengthLimitingTextInputFormatter(3),
                    ],
                    validator: _validateNumber,
                    onFieldSubmitted: index == _fields.length - 1
                        ? (_) => _cast()
                        : null,
                  ),
                ),
              FilledButton(onPressed: _cast, child: const Text('用这三个数起卦')),
            ],
          ),
        ),
        if (_reading case final reading?) ...[
          const SizedBox(height: 28),
          MeihuaResult(reading: reading),
        ],
      ],
    );
  }
}

class MeihuaResult extends StatelessWidget {
  const MeihuaResult({super.key, required this.reading});

  final MeihuaReading reading;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Semantics(
        header: true,
        child: Text('梅花易数结果', style: Theme.of(context).textTheme.titleLarge),
      ),
      const SizedBox(height: 8),
      Text('取数 ${reading.inputs.join('、')} · 第 ${reading.moving} 爻动'),
      const SizedBox(height: 12),
      HexagramCard(
        label: '本卦',
        hexagram: reading.primary,
        moving: [reading.moving],
      ),
      HexagramCard(label: '互卦', hexagram: reading.nuclear),
      HexagramCard(label: '变卦', hexagram: reading.changed),
      const SizedBox(height: 12),
      Text(
        '体卦 ${reading.body.name} · 用卦 ${reading.use.name} · 变用 ${reading.changedUse.name}',
      ),
      Text('${reading.relation} → ${reading.changedRelation}'),
      const SizedBox(height: 8),
      Text(reading.interpretation),
    ],
  );
}
