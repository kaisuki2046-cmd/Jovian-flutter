enum AccountSection {
  settings('settings'),
  security('auth'),
  phone('phone'),
  password('password'),
  identity('identity-verification'),
  deletion('deletion'),
  profile('profile'),
  privacy('privacy'),
  agreements('agreements'),
  aiPermissions('ai-permissions'),
  privacyRights('privacy-rights'),
  charts('reading-profile'),
  reports('reports'),
  appearance('appearance'),
  language('language'),
  about('about'),
  following('following'),
  followers('followers'),
  profilePreview('profile-preview'),
  socialPrivacy('social-privacy'),
  findUser('find-user'),
  socialReports('social-reports'),
  socialModeration('social-moderation'),
  socialProfile('social-profile');

  const AccountSection(this.slug);

  final String slug;
}

typedef AccountDestination = ({AccountSection section, String? profileId});

AccountDestination accountDestination(
  AccountSection section, {
  String? profileId,
}) => (section: section, profileId: profileId);
