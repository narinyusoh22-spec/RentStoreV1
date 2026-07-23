import { supabase, qs, uploadImage } from './supabase-client.js';
import { requireLogin, renderNav, updatePassword } from './auth.js';

renderNav();

let session, profile;
let avatarFile = null;

(async () => {
  const auth = await requireLogin();
  if (!auth) return;
  session = auth.session;
  profile = auth.profile;
  fillForm();
})();

function fillForm() {
  qs('#profileName').value = profile?.full_name || '';
  qs('#profilePhone').value = profile?.phone || '';
  qs('#profileEmail').value = session.user.email || '';
  qs('#profileRole').value = profile?.role === 'seller' ? 'ผู้ขาย' : 'ลูกค้า';

  if (profile?.avatar_url) {
    const box = qs('#avatarUpload');
    box.style.backgroundImage = `url('${profile.avatar_url}')`;
    box.classList.add('has-image');
    qs('#avatarLabel').innerHTML = '';
  }
}

qs('#avatarFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  avatarFile = file;
  const box = qs('#avatarUpload');
  box.style.backgroundImage = `url('${URL.createObjectURL(file)}')`;
  box.classList.add('has-image');
  qs('#avatarLabel').innerHTML = '';
});

qs('#profileForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = qs('#profileForm button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'กำลังบันทึก...';

  try {
    const updates = {
      full_name: qs('#profileName').value.trim(),
      phone: qs('#profilePhone').value.trim(),
    };
    if (avatarFile) updates.avatar_url = await uploadImage(avatarFile, `avatars/${session.user.id}`);

    const { data, error } = await supabase.from('profiles').update(updates).eq('id', session.user.id).select().single();
    if (error) throw error;

    profile = data;
    qs('#profileMsg').innerHTML = `<div class="alert alert-success">บันทึกข้อมูลเรียบร้อยแล้ว</div>`;
    renderNav(); // refresh the name shown in the navbar
  } catch (err) {
    qs('#profileMsg').innerHTML = `<div class="alert alert-danger">บันทึกไม่สำเร็จ: ${err.message}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'บันทึกข้อมูล';
  }
});

qs('#passwordForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const p1 = qs('#newPass1').value;
  const p2 = qs('#newPass2').value;
  const msg = qs('#passwordMsg');

  if (p1 !== p2) {
    msg.innerHTML = `<div class="alert alert-danger">รหัสผ่านทั้งสองช่องไม่ตรงกัน</div>`;
    return;
  }

  const btn = qs('#passwordForm button[type="submit"]');
  btn.disabled = true;

  try {
    await updatePassword(p1);
    msg.innerHTML = `<div class="alert alert-success">เปลี่ยนรหัสผ่านเรียบร้อยแล้ว</div>`;
    qs('#passwordForm').reset();
  } catch (err) {
    msg.innerHTML = `<div class="alert alert-danger">เปลี่ยนรหัสผ่านไม่สำเร็จ: ${err.message}</div>`;
  } finally {
    btn.disabled = false;
  }
});
