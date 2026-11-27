export function normalizeEmail(value) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return email;
}

export function normalizePhone(value) {
  if (typeof value !== 'string' || value.length > 32) return;
  const number = value.trim().replace(/[ ()-]/g, '');
  if (/^1[3-9]\d{9}$/.test(number)) return '+86' + number;
  if (/^\+[1-9]\d{7,14}$/.test(number)) return number;
}
