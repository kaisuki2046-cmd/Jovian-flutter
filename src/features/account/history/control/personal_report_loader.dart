import 'dart:async';

import 'package:jovian_destiny/jovian_destiny.dart';

import '../../../../bootstrap/destiny.dart'
    show calculateDestinyReading, loadBirthPlaces;
import '../../../../shared/local_compute/local_compute.dart';
import '../../../destiny/frontend/control/destiny_device_birth_profile.dart';
import '../../../destiny/model/birth_profile_draft.dart';
import '../../auth/control/account_controller.dart';
import '../../auth/model/session.dart';
import '../../reading-profile/model/account_birth_fields.dart';
import '../model/personal_report_data.dart';
import '../model/report_history.dart';

Future<PersonalReportData?> loadPersonalReport(
  AccountController account,
  AccountSession owner,
  Future<void> cancel,
) async {
  var cancelled = false;
  unawaited(
    cancel.then<void>((_) {
      cancelled = true;
    }),
  );
  bool current() =>
      !cancelled &&
      !account.sessionChanging &&
      account.authorizedSession?.scope == owner.scope;
  try {
    final archive = await account.reports.latest(
      owner.id,
      ReportKind.destiny,
      cancel: cancel,
    );
    if (!current()) return null;
    final report = PersonalReportData.fromSnapshot(
      archive?.destiny['chartSnapshot'],
      origin: PersonalReportOrigin.archive,
      overview: archive?.body,
    );
    if (report != null) return report;
  } on Exception {
    if (!current()) return null;
  }

  if (!current() ||
      account.memberId != owner.id ||
      !const LocalCompute().isAvailable)
    return null;
  try {
    AccountBirthFields? fields;
    try {
      fields = await account.readBirthFields(owner.id, cancel: cancel);
    } on Exception {
      // The device profile can still be available when the account read fails.
    }
    if (!current()) return null;
    List<BirthPlace>? places;
    Future<List<BirthPlace>> loadPlaces() async =>
        places ??= await loadBirthPlaces();
    final draft = fields?.hasData == true
        ? BirthProfileDraft.fromAccount(fields!, await loadPlaces())
        : null;
    final saved = switch ((draft?.date, draft?.place)) {
      (final date?, final place?) => BirthProfile(
        date: date,
        time: draft?.time ?? const BirthTime(),
        place: place,
        gender: draft?.gender ?? BirthGender.other,
      ),
      _ => await readLocalDestinyBirthProfile(owner.id, loadPlaces),
    };
    if (saved == null || !current()) return null;
    final result = await calculateDestinyReading(saved, cancel, (_) {});
    return current()
        ? PersonalReportData.fromSnapshot(
            result.archive['chartSnapshot'],
            origin: PersonalReportOrigin.birthProfile,
          )
        : null;
  } on Exception {
    return null;
  }
}
