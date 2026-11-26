import 'package:material_ui/material_ui.dart';

import '../../reading-profile/model/account_reading_profile.dart';
import '../model/profile_preview.dart';

class PublicBirthDetails extends StatelessWidget {
  const PublicBirthDetails({super.key, required this.profile});
  final VisitorProfile profile;

  @override
  Widget build(BuildContext context) {
    if (profile.reading.isEmpty) return const SizedBox.shrink();
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Semantics(
              header: true,
              child: Text(
                '出生资料',
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ),
            for (final field in ReadingField.values)
              if (profile.reading[field] case final value?)
                ProfileDetailRow(field.label, field.display(value)),
          ],
        ),
      ),
    );
  }
}

class ProfileDetailRow extends StatelessWidget {
  const ProfileDetailRow(this.label, this.value, {super.key});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 10),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(flex: 2, child: Text(label)),
        const SizedBox(width: 8),
        Expanded(flex: 3, child: Text(value, textAlign: TextAlign.end)),
      ],
    ),
  );
}
