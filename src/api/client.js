const API_BASE = import.meta.env.VITE_API_BASE ?? '';

const TOKEN_KEY = 'colorado-golf-token';
const USER_KEY = 'colorado-golf-user';

export function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)?.trim() || null;
  } catch {
    return null;
  }
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setAuthSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuthSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function headers() {
  const h = { 'Content-Type': 'application/json' };
  const token = getStoredToken();
  if (token) h.Authorization = `Bearer ${token}`;
  const key = import.meta.env.VITE_API_KEY;
  if (key) h['X-ColoradoGolf-Api-Key'] = key;
  return h;
}

async function parseError(res) {
  const text = await res.text();
  try {
    const j = JSON.parse(text);
    if (j.detail) {
      return typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail);
    }
  } catch {
    /* ignore */
  }
  return text || `Request failed (${res.status})`;
}

export async function adminCreateUser(payload) {
  const res = await fetch(`${API_BASE}/api/admin/users`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = await res.json();
  return data.user;
}

export async function fetchAdminUsers() {
  const res = await fetch(`${API_BASE}/api/admin/users/approved`, {
    method: 'GET',
    headers: headers(),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function adminUpdateUser(username, payload) {
  const res = await fetch(
    `${API_BASE}/api/admin/users/${encodeURIComponent(username)}`,
    {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) throw new Error(await parseError(res));
  const data = await res.json();
  return data.user;
}

export async function patchCourseHoleCount(courseId, holeCount) {
  const res = await fetch(
    `${API_BASE}/api/courses/${encodeURIComponent(courseId)}/hole-count`,
    {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({ holeCount }),
    },
  );
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function patchCourseHolePars(courseId, holeCount, holePars) {
  const res = await fetch(
    `${API_BASE}/api/courses/${encodeURIComponent(courseId)}/hole-pars`,
    {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({ holeCount, holePars }),
    },
  );
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function patchCourseHoleStrokeIndex(courseId, holeCount, holeStrokeIndex) {
  const res = await fetch(
    `${API_BASE}/api/courses/${encodeURIComponent(courseId)}/hole-stroke-index`,
    {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({ holeCount, holeStrokeIndex }),
    },
  );
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function patchCourseRatings(courseId, payload) {
  const res = await fetch(
    `${API_BASE}/api/courses/${encodeURIComponent(courseId)}/ratings`,
    {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function patchCourseHoleSss(courseId, holeCount, holeSss) {
  const res = await fetch(
    `${API_BASE}/api/courses/${encodeURIComponent(courseId)}/hole-sss`,
    {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({ holeCount, holeSss }),
    },
  );
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function requestPasswordReset(email) {
  const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function loginAccount(email, password) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function logoutAccount() {
  const token = getStoredToken();
  if (token) {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        headers: headers(),
      });
    } catch {
      /* ignore */
    }
  }
  clearAuthSession();
}

export async function fetchMe() {
  const res = await fetch(`${API_BASE}/api/auth/me`, { headers: headers() });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function changePassword(currentPassword, newPassword) {
  const res = await fetch(`${API_BASE}/api/auth/change-password`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function fetchState() {
  const res = await fetch(`${API_BASE}/api/state`, { headers: headers() });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function patchProgress(courseId, entry) {
  // JSON.stringify omits undefined keys — never send a body without entry.
  const safe =
    entry && typeof entry === 'object'
      ? entry
      : { played: false };
  const body = {
    courseId,
    entry: {
      played: Boolean(safe.played),
      playedAt: safe.playedAt ?? null,
      fieldOverrides: safe.fieldOverrides ?? null,
      customName: safe.customName ?? null,
      handicapIndex: safe.handicapIndex ?? null,
      courseHandicap: safe.courseHandicap ?? null,
      holeScores: Array.isArray(safe.holeScores) ? safe.holeScores : null,
    },
  };
  const res = await fetch(`${API_BASE}/api/progress`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function putCustomCourses(courses) {
  const res = await fetch(`${API_BASE}/api/custom-courses`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify({ courses }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function postCustomCourse(course) {
  const res = await fetch(`${API_BASE}/api/custom-courses`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(course),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}
