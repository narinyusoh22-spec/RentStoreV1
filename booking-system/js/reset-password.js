import { supabase, qs } from './supabase-client.js';
import { updatePassword } from './auth.js';

const submitBtn = qs('#resetSubmitBtn');
let linkReady = false;

function markReady() {
  if (linkReady) return;
  linkReady = true;
  submitBtn.disabled = false;
  submitBtn.textContent = 'ตั้งรหัสผ่านใหม่';
}

// Supabase-js parses the recovery token in the URL automatically and fires
// this event once the temporary "recovery" session is established.
supabase.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') markReady();
});

// fallback in case the event already fired before this listener attached
supabase.auth.getSession().then(({ data: { session } }) => {
  if (session) {
    markReady();
  } else {
    qs('#resetMsg').innerHTML = `<div class="alert alert-warning">ลิงก์นี้ไม่ถูกต้องหรือหมดอายุแล้ว กรุณาขอลิงก์ใหม่จากหน้าเข้าสู่ระบบ</div>`;
  }
});

qs('#resetForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const p1 = qs('#newPassword').value;
  const p2 = qs('#confirmPassword').value;
  const msg = qs('#resetMsg');

  if (p1 !== p2) {
    msg.innerHTML = `<div class="alert alert-danger">รหัสผ่านทั้งสองช่องไม่ตรงกัน</div>`;
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'กำลังบันทึก...';

  try {
    await updatePassword(p1);
    msg.innerHTML = `<div class="alert alert-success">ตั้งรหัสผ่านใหม่สำเร็จแล้ว กำลังพาไปหน้าเข้าสู่ระบบ...</div>`;
    qs('#resetForm').classList.add('d-none');
    setTimeout(() => (window.location.href = 'login.html'), 1800);
  } catch (err) {
    msg.innerHTML = `<div class="alert alert-danger">ตั้งรหัสผ่านไม่สำเร็จ: ${err.message}</div>`;
    submitBtn.disabled = false;
    submitBtn.textContent = 'ตั้งรหัสผ่านใหม่';
  }
});
