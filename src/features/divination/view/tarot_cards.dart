import 'package:jovian_divination/jovian_divination.dart';
import 'package:material_ui/material_ui.dart';

const _guidePositions = ['现状', '关键影响', '趋势'];
const _cardAssets = 'src/features/divination/assets/tarot';

class TarotGrid extends StatelessWidget {
  const TarotGrid({
    super.key,
    required this.slotCount,
    required this.selectedSlots,
    required this.choose,
    this.busy = false,
  });

  final int slotCount;
  final List<int> selectedSlots;
  final ValueChanged<int> choose;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Semantics(
          liveRegion: true,
          child: Text('已选 ${selectedSlots.length} / 3 张 · 现状、关键影响、趋势'),
        ),
        const SizedBox(height: 10),
        LayoutBuilder(
          builder: (context, constraints) {
            const gap = 6.0;
            final columns = ((constraints.maxWidth + gap) / (44 + gap))
                .floor()
                .clamp(1, 9);
            return GridView.builder(
              primary: false,
              physics: const NeverScrollableScrollPhysics(),
              shrinkWrap: true,
              padding: EdgeInsets.zero,
              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: columns,
                crossAxisSpacing: gap,
                mainAxisSpacing: gap,
                childAspectRatio: 0.62,
              ),
              itemCount: slotCount,
              itemBuilder: (context, slot) {
                final position = selectedSlots.indexOf(slot);
                final selected = position >= 0;
                final tap = selected || busy ? null : () => choose(slot);
                return Semantics(
                  key: ValueKey('tarot-slot-$slot'),
                  button: true,
                  selected: selected,
                  enabled: tap != null,
                  label:
                      '第 ${slot + 1} 张牌'
                      '${selected ? '，已选为${_guidePositions[position]}' : ''}',
                  onTap: tap,
                  excludeSemantics: true,
                  child: Material(
                    color: color.secondaryContainer,
                    borderRadius: BorderRadius.circular(5),
                    clipBehavior: Clip.antiAlias,
                    child: Ink.image(
                      image: const AssetImage('$_cardAssets/back.jpg'),
                      fit: BoxFit.cover,
                      child: InkWell(
                        onTap: tap,
                        excludeFromSemantics: true,
                        child: selected
                            ? Center(
                                child: CircleAvatar(
                                  radius: 11,
                                  backgroundColor: color.primaryContainer,
                                  foregroundColor: color.onPrimaryContainer,
                                  child: Text('${position + 1}'),
                                ),
                              )
                            : null,
                      ),
                    ),
                  ),
                );
              },
            );
          },
        ),
      ],
    );
  }
}

class TarotReveal extends StatelessWidget {
  const TarotReveal({super.key, required this.draw});

  final TarotDraw draw;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final card in draw.cards)
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    _guidePositions[card.position.index],
                    textAlign: TextAlign.center,
                    style: text.titleSmall,
                  ),
                  const SizedBox(height: 6),
                  AspectRatio(
                    aspectRatio: 0.58,
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(5),
                      child: RotatedBox(
                        quarterTurns:
                            card.face.orientation == TarotOrientation.reversed
                            ? 2
                            : 0,
                        child: Image.asset(
                          '$_cardAssets/${card.face.card.id}.jpg',
                          fit: BoxFit.contain,
                          excludeFromSemantics: true,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(card.face.card.name, textAlign: TextAlign.center),
                  Text(
                    card.face.orientation == TarotOrientation.reversed
                        ? '逆位'
                        : '正位',
                    textAlign: TextAlign.center,
                    style: text.bodySmall,
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}
