import { supabase, qs, qsa, formatDateThai, formatTime, formatMoney, statusLabel, starString, uploadImage } from './supabase-client.js';
import { requireRole, renderNav } from './auth.js';

renderNav();

let session, shop, services = [], bookings = [], reviews = [];
let coverFile = null;
let bookingStatusFilter = 'all';
let serviceModal, editingServiceId = null, svcImgFile = null;

(async () => {
  const auth = await requireRole('seller');
  if (!auth) return;
  session = auth.session;

  const { data: shops } = await supabase.from('shops').select('*').eq('owner_id', session.user.id).limit(1);

  qs('#loadingState').classList.add('d-none');

  if (!shops || !shops.length) {
    qs('#noShopState').classList.remove('d-none');
    return;
  }

  shop = shops[0];
  qs('#dashState').classList.remove('d-none');
  qs('#shopTitle').textContent = shop.name;

  serviceModal = new bootstrap.Modal(qs('#serviceModal'));

  fillShopForm();
  attachShopForm();
  attachServiceHandlers();
  attachBookingFilter();

  await Promise.all([loadServices(), loadBookings(), loadReviews()]);
  renderOverview();
})();

// ============================================================
// OVERVIEW
// ============================================================
function renderOverview() {
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = bookings.filter((b) => b.booking_date === today && b.status !== 'cancelled').length;
  const pendingCount = bookings.filter((b) => b.status === 'pending').length;
  const revenue = bookings
    .filter((b) => b.status === 'completed')
    .reduce((sum, b) => sum + Number(b.services?.price || 0), 0);
  const avg = reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : null;

  const stats = [
    { label: 'จองวันนี้', value: todayCount, sub: '' },
    { label: 'รอยืนยัน', value: pendingCount, sub: 'ต้องตอบกลับลูกค้า' },
    { label: 'รายได้ที่เสร็จสิ้น', value: `฿${formatMoney(revenue)}`, sub: '' },
    { label: 'คะแนนเฉลี่ย', value: avg ? avg.toFixed(1) : '—', sub: `${reviews.length} รีวิว` },
  ];

  qs('#statGrid').innerHTML = stats
    .map(
      (s) => `
      <div class="col">
        <div class="stat-card">
          <div class="stat-label">${s.label}</div>
          <div class="stat-value">${s.value}</div>
          ${s.sub ? `<div class="stat-sub">${s.sub}</div>` : ''}
        </div>
      </div>`
    )
    .join('');

  const recent = [...bookings].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 5);

  qs('#recentBookings').innerHTML = recent.length
    ? `<div class="table-responsive"><table class="table table-hover align-middle bg-white"><thead class="table-light"><tr><th>วันที่/เวลา</th><th>บริการ</th><th>ลูกค้า</th><th>สถานะ</th></tr></thead><tbody>
        ${recent.map((b) => `<tr>
          <td>${formatDateThai(b.booking_date).full} · ${formatTime(b.booking_time)}</td>
          <td>${b.services?.name || ''}</td>
          <td>${b.profiles?.full_name || ''}</td>
          <td><span class="badge badge-${b.status}">${statusLabel(b.status)}</span></td>
        </tr>`).join('')}
      </tbody></table></div>`
    : `<div class="empty-state">ยังไม่มีการจองเข้ามา</div>`;
}

// ============================================================
// SHOP EDITOR
// ============================================================
function fillShopForm() {
  qs('#editName').value = shop.name || '';
  qs('#editCategory').value = shop.category || 'บริการทั่วไป';
  qs('#editDesc').value = shop.description || '';
  qs('#editAddress').value = shop.address || '';
  qs('#editPhone').value = shop.phone || '';
  qs('#editActive').checked = shop.is_active;
  qs('#editOpen').value = (shop.open_time || '09:00').slice(0, 5);
  qs('#editClose').value = (shop.close_time || '20:00').slice(0, 5);
  if (shop.cover_url) {
    const box = qs('#coverUpload');
    box.style.backgroundImage = `url('${shop.cover_url}')`;
    box.classList.add('has-image');
  }
}

function attachShopForm() {
  qs('#coverFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    coverFile = file;
    const box = qs('#coverUpload');
    box.style.backgroundImage = `url('${URL.createObjectURL(file)}')`;
    box.classList.add('has-image');
  });

  qs('#shopEditForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = qs('#shopEditForm button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'กำลังบันทึก...';

    try {
      const updates = {
        name: qs('#editName').value.trim(),
        category: qs('#editCategory').value,
        description: qs('#editDesc').value.trim(),
        address: qs('#editAddress').value.trim(),
        phone: qs('#editPhone').value.trim(),
        is_active: qs('#editActive').checked,
        open_time: qs('#editOpen').value,
        close_time: qs('#editClose').value,
      };
      if (coverFile) updates.cover_url = await uploadImage(coverFile, `shops/${session.user.id}`);

      const { data, error } = await supabase.from('shops').update(updates).eq('id', shop.id).select().single();
      if (error) throw error;
      shop = data;
      qs('#shopTitle').textContent = shop.name;
      qs('#shopFormMsg').innerHTML = `<div class="alert alert-success">บันทึกข้อมูลร้านเรียบร้อยแล้ว</div>`;
    } catch (err) {
      qs('#shopFormMsg').innerHTML = `<div class="alert alert-danger">บันทึกไม่สำเร็จ: ${err.message}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = 'บันทึกข้อมูลร้าน';
    }
  });
}

// ============================================================
// SERVICES
// ============================================================
async function loadServices() {
  const { data } = await supabase.from('services').select('*').eq('shop_id', shop.id).order('created_at');
  services = data || [];
  renderServices();
}

function renderServices() {
  const wrap = qs('#serviceRowList');
  if (!services.length) {
    wrap.innerHTML = `<div class="empty-state">ยังไม่มีบริการ กด "+ เพิ่มบริการ" เพื่อเริ่มต้น</div>`;
    return;
  }
  wrap.innerHTML = services
    .map(
      (s) => `
      <div class="service-row">
        <div class="service-row-img" style="${s.image_url ? `background-image:url('${s.image_url}')` : ''}"></div>
        <div>
          <div class="service-row-name">${s.name} ${s.is_active ? '' : '<span class="badge badge-cancelled">ปิดชั่วคราว</span>'}</div>
          <div class="service-row-meta">฿${formatMoney(s.price)} · ${s.duration_minutes} นาที</div>
        </div>
        <div class="d-flex gap-2">
          <button class="btn btn-outline-secondary btn-sm" data-edit-service="${s.id}">แก้ไข</button>
          <button class="btn btn-outline-danger btn-sm" data-delete-service="${s.id}">ลบ</button>
        </div>
      </div>`
    )
    .join('');

  qsa('[data-edit-service]').forEach((btn) =>
    btn.addEventListener('click', () => openServiceModal(services.find((s) => s.id === btn.dataset.editService)))
  );
  qsa('[data-delete-service]').forEach((btn) =>
    btn.addEventListener('click', () => deleteService(btn.dataset.deleteService))
  );
}

function attachServiceHandlers() {
  qs('#btnAddService').addEventListener('click', () => openServiceModal(null));
  qs('#svcSave').addEventListener('click', saveService);
  qs('#svcImgFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    svcImgFile = file;
    const box = qs('#svcImgUpload');
    box.style.backgroundImage = `url('${URL.createObjectURL(file)}')`;
    qs('#svcImgLabel').textContent = '';
  });
}

async function deleteService(id) {
  if (!confirm('ลบบริการนี้หรือไม่? การจองที่ผูกกับบริการนี้จะถูกลบไปด้วย')) return;
  const { error } = await supabase.from('services').delete().eq('id', id);
  if (error) return alert('ลบไม่สำเร็จ: ' + error.message);
  await loadServices();
}

function openServiceModal(existing) {
  editingServiceId = existing?.id || null;
  svcImgFile = null;
  qs('#svcModalTitle').textContent = existing ? 'แก้ไขบริการ' : 'เพิ่มบริการใหม่';
  qs('#svcMsg').innerHTML = '';
  qs('#svcName').value = existing?.name || '';
  qs('#svcDesc').value = existing?.description || '';
  qs('#svcPrice').value = existing?.price ?? 0;
  qs('#svcDuration').value = existing?.duration_minutes ?? 60;
  qs('#svcActive').checked = existing?.is_active !== false;

  const box = qs('#svcImgUpload');
  box.classList.remove('has-image');
  box.style.backgroundImage = existing?.image_url ? `url('${existing.image_url}')` : '';
  qs('#svcImgLabel').textContent = existing?.image_url ? '' : 'คลิกเพื่ออัปโหลดรูปบริการ';
  if (existing?.image_url) box.classList.add('has-image');

  serviceModal.show();
}

async function saveService() {
  const btn = qs('#svcSave');
  btn.disabled = true;
  try {
    const existing = services.find((s) => s.id === editingServiceId);
    let image_url = existing?.image_url || null;
    if (svcImgFile) image_url = await uploadImage(svcImgFile, `services/${shop.id}`);

    const payload = {
      shop_id: shop.id,
      name: qs('#svcName').value.trim(),
      description: qs('#svcDesc').value.trim(),
      price: Number(qs('#svcPrice').value),
      duration_minutes: Number(qs('#svcDuration').value),
      is_active: qs('#svcActive').checked,
      image_url,
    };

    const { error } = editingServiceId
      ? await supabase.from('services').update(payload).eq('id', editingServiceId)
      : await supabase.from('services').insert(payload);

    if (error) throw error;
    serviceModal.hide();
    await loadServices();
  } catch (err) {
    qs('#svcMsg').innerHTML = `<div class="alert alert-danger">บันทึกไม่สำเร็จ: ${err.message}</div>`;
  } finally {
    btn.disabled = false;
  }
}

// ============================================================
// BOOKINGS
// ============================================================
async function loadBookings() {
  const { data } = await supabase
    .from('bookings')
    .select('*, services:service_id(name, price), profiles:customer_id(full_name, phone)')
    .eq('shop_id', shop.id)
    .order('booking_date', { ascending: false })
    .order('booking_time', { ascending: false });

  bookings = data || [];
  renderBookings();
}

function attachBookingFilter() {
  qs('#statusFilter').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-status]');
    if (!btn) return;
    qsa('#statusFilter .chip').forEach((c) => c.classList.remove('active'));
    btn.classList.add('active');
    bookingStatusFilter = btn.dataset.status;
    renderBookings();
  });
}

function renderBookings() {
  const list = bookingStatusFilter === 'all' ? bookings : bookings.filter((b) => b.status === bookingStatusFilter);
  const body = qs('#bookingsTableBody');

  if (!list.length) {
    body.innerHTML = `<tr><td colspan="5"><div class="empty-state">ไม่มีรายการจองในหมวดนี้</div></td></tr>`;
    return;
  }

  body.innerHTML = list
    .map(
      (b) => `
      <tr>
        <td>${formatDateThai(b.booking_date).full}<br><span class="mono small text-secondary">${formatTime(b.booking_time)} น.</span></td>
        <td>${b.services?.name || ''}<br><span class="small text-secondary">฿${formatMoney(b.services?.price)}</span></td>
        <td>${b.profiles?.full_name || ''}<br><span class="small text-secondary">${b.profiles?.phone || ''}</span></td>
        <td><span class="badge badge-${b.status}">${statusLabel(b.status)}</span></td>
        <td>
          <div class="d-flex gap-2 flex-wrap">
            ${b.status === 'pending' ? `<button class="btn btn-primary btn-sm" data-set="${b.id}:confirmed">ยืนยัน</button><button class="btn btn-outline-danger btn-sm" data-set="${b.id}:cancelled">ยกเลิก</button>` : ''}
            ${b.status === 'confirmed' ? `<button class="btn btn-primary btn-sm" data-set="${b.id}:completed">เสร็จสิ้น</button><button class="btn btn-outline-danger btn-sm" data-set="${b.id}:cancelled">ยกเลิก</button>` : ''}
          </div>
        </td>
      </tr>`
    )
    .join('');

  qsa('[data-set]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const [id, status] = btn.dataset.set.split(':');
      btn.disabled = true;
      const { error } = await supabase.from('bookings').update({ status }).eq('id', id);
      if (error) {
        alert('อัปเดตไม่สำเร็จ: ' + error.message);
        btn.disabled = false;
        return;
      }
      await loadBookings();
      renderOverview();
    });
  });
}

// ============================================================
// REVIEWS
// ============================================================
async function loadReviews() {
  const { data } = await supabase
    .from('reviews')
    .select('*, profiles:customer_id(full_name)')
    .eq('shop_id', shop.id)
    .order('created_at', { ascending: false });
  reviews = data || [];
  renderReviews();
}

function renderReviews() {
  const avg = reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : null;
  qs('#reviewSummary').innerHTML = avg
    ? `<h3><span class="stars">★</span> ${avg.toFixed(1)} <span class="small text-secondary" style="font-family:var(--bs-body-font-family);">จาก ${reviews.length} รีวิว</span></h3>`
    : '';

  qs('#reviewsList').innerHTML = reviews.length
    ? reviews
        .map(
          (r) => `
        <div class="review-card">
          <span class="stars">${starString(r.rating)}</span>
          <p class="mb-0">${r.comment || ''}</p>
          <div class="who">${r.profiles?.full_name || 'ลูกค้า'} · ${new Date(r.created_at).toLocaleDateString('th-TH')}</div>
        </div>`
        )
        .join('')
    : `<div class="empty-state">ยังไม่มีรีวิวสำหรับร้านนี้</div>`;
}
