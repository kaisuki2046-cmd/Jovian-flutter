import 'package:jovian_divination/jovian_divination.dart';
import 'package:material_ui/material_ui.dart';

import 'guide_form.dart';

class DivinationPage extends StatelessWidget {
  const DivinationPage({
    super.key,
    this.onlineGuide,
    this.openSynastry,
    this.openAiPermissions,
    this.active = true,
  });

  final OnlineGuideController? onlineGuide;
  final VoidCallback? openSynastry;
  final VoidCallback? openAiPermissions;
  final bool active;

  @override
  Widget build(BuildContext context) => GuideForm(
    key: ObjectKey(onlineGuide),
    online: onlineGuide,
    openSynastry: openSynastry,
    openAiPermissions: openAiPermissions,
    active: active,
  );
}
