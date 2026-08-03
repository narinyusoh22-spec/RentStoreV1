import { supabase, qs } from './supabase-client.js';
import { renderNotificationBell } from './notifications.js';

// apply saved theme as early as possible (module code runs immediately on
// import, before renderNav's async work) to minimize a flash of light mode
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') document.documentElement.setAttribute('data-bs-theme', 'dark');

// ---------- auth actions ----------

export async function signUp({ email, password, fullName, phone, role }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, phone, role },
    },
  });
  if (error) throw error;
  return data;
}

export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = 'index.html';
}

// ---------- password reset ----------
// sends an email with a recovery link that lands the user on reset-password.html
export async function requestPasswordReset(email) {
  const redirectTo = new URL('reset-password.html', window.location.href).toString();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}

// used on reset-password.html (after the recovery link) and on profile.html (change password while logged in)
export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

// ---------- session / profile helpers ----------

export async function getSessionAndProfile() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { session: null, profile: null };
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();
  return { session, profile };
}

// redirect to login if not authenticated; returns {session, profile}
export async function requireLogin() {
  const { session, profile } = await getSessionAndProfile();
  if (!session) {
    window.location.href = 'login.html';
    return null;
  }
  return { session, profile };
}

// redirect if authenticated user does not have the required role
export async function requireRole(role) {
  const result = await requireLogin();
  if (!result) return null;
  if (result.profile?.role !== role) {
    alert(role === 'seller' ? 'หน้านี้สำหรับผู้ขายเท่านั้น' : 'หน้านี้สำหรับผู้ใช้ทั่วไปเท่านั้น');
    window.location.href = 'index.html';
    return null;
  }
  return result;
}

// ---------- shared nav bar ----------
// Every page has: <div id="navUser"></div> inside the nav markup.
export async function renderNav() {
  const mount = qs('#navUser');
  if (!mount) return;

  const { session, profile } = await getSessionAndProfile();
  const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
  const themeToggleHtml = `<button class="btn btn-outline-secondary btn-sm theme-toggle" id="themeToggle" type="button" title="สลับโหมดมืด/สว่าง"><i class="bi ${isDark ? 'bi-sun' : 'bi-moon-stars'}"></i></button>`;

  if (!session) {
    mount.innerHTML = `${themeToggleHtml}<a class="btn btn-outline-primary btn-sm" href="login.html">เข้าสู่ระบบ</a>`;
    setupThemeToggle();
    return;
  }

  const dashUrl = profile?.role === 'seller' ? 'seller-dashboard.html' : 'customer-dashboard.html';
  const roleText = profile?.role === 'seller' ? 'ผู้ขาย' : 'ลูกค้า';

  mount.innerHTML = `
    ${themeToggleHtml}
    <div class="d-flex align-items-center gap-2 small">
      <strong>${profile?.full_name || 'ผู้ใช้'}</strong> <span class="role-tag">${roleText}</span>
    </div>
    <a class="btn btn-outline-secondary btn-sm" href="profile.html"><i class="bi bi-person-circle"></i> โปรไฟล์</a>
    <a class="btn btn-outline-secondary btn-sm" href="${dashUrl}">แดชบอร์ดของฉัน</a>
    <button class="btn btn-outline-primary btn-sm" id="btnLogout">ออกจากระบบ</button>
  `;

  qs('#btnLogout', mount).addEventListener('click', signOut);
  setupThemeToggle();

  if (profile?.role === 'customer') {
    renderNotificationBell(mount, session);
  }
}

function setupThemeToggle() {
  const btn = qs('#themeToggle');
  if (!btn) return;
  const icon = btn.querySelector('i');
  btn.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
    if (next === 'dark') {
      document.documentElement.setAttribute('data-bs-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-bs-theme');
    }
    localStorage.setItem('theme', next);
    icon.className = next === 'dark' ? 'bi bi-sun' : 'bi bi-moon-stars';
  });
}