import { qs, qsa } from './supabase-client.js';
import { signIn, signUp, getSessionAndProfile, renderNav, requestPasswordReset } from './auth.js';

renderNav();

// if already logged in, bounce straight to the right dashboard
getSessionAndProfile().then(({ session, profile }) => {
  if (session) {
    window.location.href = profile?.role === 'seller' ? 'seller-dashboard.html' : 'customer-dashboard.html';
  }
});

const loginForm = qs('#loginForm');
const registerForm = qs('#registerForm');

// tab switching is handled natively by Bootstrap's nav-pills (data-bs-toggle="pill")
qsa('#authTabs button').forEach((btn) => btn.addEventListener('click', () => (qs('#formMsg').innerHTML = '')));

// ---------- role picker ----------
let selectedRole = 'customer';
qsa('.role-option').forEach((opt) => {
  opt.addEventListener('click', () => {
    qsa('.role-option').forEach((o) => o.classList.remove('selected'));
    opt.classList.add('selected');
    selectedRole = opt.dataset.role;
  });
});

function showMsg(text, type) {
  const cls = type === 'error' ? 'alert-danger' : 'alert-success';
  qs('#formMsg').innerHTML = `<div class="alert ${cls}">${text}</div>`;
}

// ---------- login ----------
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = loginForm.querySelector('button');
  btn.disabled = true;
  try {
    await signIn({
      email: qs('#loginEmail').value.trim(),
      password: qs('#loginPassword').value,
    });
    const { profile } = await getSessionAndProfile();
    window.location.href = profile?.role === 'seller' ? 'seller-dashboard.html' : 'customer-dashboard.html';
  } catch (err) {
    showMsg(err.message === 'Invalid login credentials' ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' : err.message, 'error');
    btn.disabled = false;
  }
});

// ---------- register ----------
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = registerForm.querySelector('button');
  btn.disabled = true;
  try {
    const { session } = await signUp({
      email: qs('#regEmail').value.trim(),
      password: qs('#regPassword').value,
      fullName: qs('#regName').value.trim(),
      phone: qs('#regPhone').value.trim(),
      role: selectedRole,
    });

    if (session) {
      window.location.href = selectedRole === 'seller' ? 'register-shop.html' : 'index.html';
    } else {
      showMsg('สมัครสำเร็จ! กรุณายืนยันอีเมลของคุณก่อนเข้าสู่ระบบ (ตรวจสอบกล่องจดหมาย)', 'success');
      registerForm.reset();
    }
  } catch (err) {
    showMsg(err.message.includes('already registered') ? 'อีเมลนี้ถูกใช้สมัครแล้ว' : err.message, 'error');
  } finally {
    btn.disabled = false;
  }
});

// ---------- forgot password ----------
qs('#sendResetBtn').addEventListener('click', async () => {
  const btn = qs('#sendResetBtn');
  const email = qs('#forgotEmail').value.trim();
  const msg = qs('#forgotMsg');
  if (!email) return;

  btn.disabled = true;
  try {
    await requestPasswordReset(email);
    msg.innerHTML = `<div class="alert alert-success">ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลแล้ว กรุณาตรวจสอบกล่องจดหมาย (รวมถึงโฟลเดอร์ Junk/Spam)</div>`;
  } catch (err) {
    msg.innerHTML = `<div class="alert alert-danger">ส่งไม่สำเร็จ: ${err.message}</div>`;
  } finally {
    btn.disabled = false;
  }
});