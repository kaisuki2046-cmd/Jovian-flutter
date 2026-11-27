export function publicProfile(user) {
  return {
    id: user.id, email: user.email, displayName: user.display_name, bio: user.bio, hasPassword: Boolean(user.password_hash),
    ...(user.profile_visibility ? { visibility: profileVisibility(user) } : {}),
  };
}

export function profileVisibility(user) {
  const saved = JSON.parse(user.profile_visibility ?? '{}');
  return { displayName: saved.displayName === true, bio: saved.bio === true };
}

export function profileForVisitor(user) {
  const visibility = profileVisibility(user);
  return {
    ...(visibility.displayName && user.display_name ? { displayName: user.display_name } : {}),
    ...(visibility.bio && user.bio ? { bio: user.bio } : {}),
  };
}

export function profileInput(body) {
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
  const bio = typeof body.bio === 'string' ? body.bio.trim() : null;
  if (!displayName || Array.from(displayName).length > 40 || bio === null || Array.from(bio).length > 160) {
    return;
  }
  const { visibility } = body;
  if (visibility === undefined) return { displayName, bio };
  if (typeof visibility?.displayName !== 'boolean' || typeof visibility?.bio !== 'boolean') return;
  return { displayName, bio, visibility: { displayName: visibility.displayName, bio: visibility.bio } };
}
