import { supabase, qs, uploadImage } from './supabase-client.js';
import { requireRole, renderNav } from './auth.js';

renderNav();

let session, profile;
let coverFile = null;

(async () => {
  const auth = await requireRole('seller');
  if (!auth) return;
  session = auth.session;
  profile = auth.profile;

  // if this seller already owns a shop, send them to the dashboard instead
  const { data: existing } = await supabase.from('shops').select('id').eq('owner_id', session.user.id).limit(1);
  if (existing && existing.length) {
    window.location.href = 'seller-dashboard.html';
  }
})();

qs('#coverFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  coverFile = file;
  const url = URL.createObjectURL(file);
  const box = qs('#coverUpload');
  box.style.backgroundImage = `url('${url}')`;
  box.classList.add('has-image');
});

function showMsg(text, type) {
  const cls = type === 'error' ? 'alert-danger' : 'alert-success';
  qs('#formMsg').innerHTML = `<div class="alert ${cls}">${text}</div>`;
}

qs('#shopForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = qs('#shopForm button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'กำลังบันทึก...';

  try {
    let cover_url = null;
    if (coverFile) {
      cover_url = await uploadImage(coverFile, `shops/${session.user.id}`);
    }

    const { data: shop, error } = await supabase
      .from('shops')
      .insert({
        owner_id: session.user.id,
        name: qs('#shopName').value.trim(),
        category: qs('#shopCategory').value,
        description: qs('#shopDesc').value.trim(),
        address: qs('#shopAddress').value.trim(),
        phone: qs('#shopPhone').value.trim(),
        open_time: qs('#openTime').value,
        close_time: qs('#closeTime').value,
        cover_url,
      })
      .select()
      .single();

    if (error) throw error;
    window.location.href = 'seller-dashboard.html';
  } catch (err) {
    showMsg('เปิดร้านไม่สำเร็จ: ' + err.message, 'error');
    btn.disabled = false;
    btn.textContent = 'เปิดร้านและเข้าสู่แดชบอร์ด';
  }
});
