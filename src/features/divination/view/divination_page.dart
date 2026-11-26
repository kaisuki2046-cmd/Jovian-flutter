import 'package:jovian_divination/jovian_divination.dart';
import 'package:material_ui/material_ui.dart';

import 'guide_form.dart';
import 'liuyao_form.dart';
import 'meihua_page.dart';

class DivinationPage extends StatelessWidget {
  const DivinationPage({
    super.key,
    this.onlineGuide,
    this.openAccount,
    this.openDestiny,
  });

  final OnlineGuideController? onlineGuide;
  final VoidCallback? openAccount;
  final VoidCallback? openDestiny;

  @override
  Widget build(BuildContext context) => DefaultTabController(
    length: 3,
    child: Scaffold(
      appBar: AppBar(
        title: const Text('算事'),
        actions: [
          if (openDestiny != null)
            TextButton(onPressed: openDestiny, child: const Text('命理')),
          if (openAccount != null)
            IconButton(
              tooltip: '个人中心',
              onPressed: openAccount,
              icon: const Icon(Icons.account_circle_outlined),
            ),
        ],
        bottom: const TabBar(
          tabs: [
            Tab(text: '综合算事'),
            Tab(text: '梅花易数'),
            Tab(text: '六爻'),
          ],
        ),
      ),
      body: SafeArea(
        top: false,
        child: Builder(
          builder: (context) {
            final tabs = DefaultTabController.of(context);
            return AnimatedBuilder(
              animation: tabs,
              builder: (context, _) => TabBarView(
                controller: tabs,
                children: [
                  GuideForm(key: ObjectKey(onlineGuide), online: onlineGuide),
                  const MeihuaForm(),
                  LiuYaoForm(active: tabs.index == 2),
                ],
              ),
            );
          },
        ),
      ),
    ),
  );
}
