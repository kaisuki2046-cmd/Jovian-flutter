import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import 'interface_language.dart';

class UidCopyButton extends StatelessWidget {
  const UidCopyButton({super.key, required this.uid});

  final String uid;

  Future<void> _copy(BuildContext context) async {
    var notice = 'UID 已复制';
    try {
      await Clipboard.setData(ClipboardData(text: uid));
    } on PlatformException {
      notice = '暂时无法复制 UID，请重试。';
    }
    if (!context.mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: UiText(notice)));
  }

  @override
  Widget build(BuildContext context) => Align(
    alignment: Alignment.centerLeft,
    child: MergeSemantics(
      child: Semantics(
        button: true,
        label: context.uiLabel('复制 UID {uid}').replaceFirst('{uid}', uid),
        child: Tooltip(
          excludeFromSemantics: true,
          message: context.uiLabel('复制 UID'),
          child: InkWell(
            onTap: () => _copy(context),
            onLongPress: () => _copy(context),
            borderRadius: BorderRadius.circular(8),
            child: ExcludeSemantics(
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Wrap(
                  spacing: 6,
                  runSpacing: 2,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text(
                      'UID $uid',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    const Icon(Icons.copy_outlined, size: 14),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}
