import { supabase, qs, formatMoney, starString } from './supabase-client.js';
import { getSessionAndProfile, renderNav } from './auth.js';

renderNav();

const params = new URLSearchParams(window.location.search);
const shopId = params.get('id');
const main = qs('#shopMain');

if (!shopId) {
  main.innerHTML = `<div class="empty-state">ไม่พบร้านค้าที่ระบุ</div>`;
  throw new Error('missing shop id');
}

let shop, services, reviews, session, profile;
let selectedServiceId = null;
let selectedTime = null;

async function load() {
  const [{ data: shopData, error: shopErr }, { data: serviceData }, { data: reviewData }, sess] = await Promise.all([
    supabase.from('shops').select('*').eq('id', shopId).single(),
    supabase.from('services').select('*').eq('shop_id', shopId).eq('is_active', true).order('price'),
    supabase
      .from('reviews')
      .select('*, profiles:customer_id(full_name)')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false }),
    getSessionAndProfile(),
  ]);

  if (shopErr || !shopData) {
    main.innerHTML = `<div class="empty-state">ไม่พบร้านค้านี้ หรือร้านถูกปิดใช้งาน</div>`;
    return;
  }

  shop = shopData;
  services = serviceData || [];
  reviews = reviewData || [];
  session = sess.session;
  profile = sess.profile;

  if (services.length) selectedServiceId = services[0].id;

  render();
}

function avgRating() {
  if (!reviews.length) return null;
  return reviews.reduce((a, r) => a + r.rating, 0) / reviews.length;
}

function render() {
  const cover = qs('#shopCover');
  if (shop.cover_url) cover.style.backgroundImage = `url('${shop.cover_url}')`;
  else cover.style.background = 'linear-gradient(135deg, var(--bs-primary), var(--primary-light))';

  const avg = avgRating();

  main.innerHTML = `
    <div class="row g-4">
      <div class="col-lg-8">
        <div class="mb-4">
          <span class="shop-card-cat">${shop.category}</span>
          <h1>${shop.name}</h1>
          <div class="shop-info-meta">
            ${avg ? `<span><span class="stars">★</span> <span class="rating-num">${avg.toFixed(1)}</span> (${reviews.length} รีวิว)</span>` : '<span>ยังไม่มีรีวิว</span>'}
            ${shop.address ? `<span><i class="bi bi-geo-alt"></i> ${shop.address}</span>` : ''}
            ${shop.phone ? `<span><i class="bi bi-telephone"></i> ${shop.phone}</span>` : ''}
            <span><i class="bi bi-clock"></i> ${shop.open_time?.slice(0,5)} - ${shop.close_time?.slice(0,5)}</span>
          </div>
          <p>${shop.description || ''}</p>
        </div>

        <h3>บริการของร้าน</h3>
        <div id="serviceList">
          ${services.length ? services.map(serviceItemHtml).join('') : '<p class="text-secondary">ร้านนี้ยังไม่ได้เพิ่มบริการ</p>'}
        </div>

        <h3 class="mt-5">รีวิวจากลูกค้า</h3>
        <div id="reviewList">
          ${reviews.length ? reviews.map(reviewItemHtml).join('') : '<p class="text-secondary">ยังไม่มีรีวิวสำหรับร้านนี้</p>'}
        </div>
      </div>

      <div class="col-lg-4">
        <div class="booking-widget card shadow-sm border-0" id="bookingWidget">
          <div class="card-body p-4">
            ${bookingWidgetHtml()}
          </div>
        </div>
      </div>
    </div>
  `;

  qs('#serviceList')?.querySelectorAll('[data-book]').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedServiceId = btn.dataset.book;
      qs('#serviceSelect') && (qs('#serviceSelect').value = selectedServiceId);
      selectedTime = null;
      renderSlots();
      qs('#bookingWidget').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  attachBookingHandlers();
}

function serviceItemHtml(s) {
  const img = s.image_url ? `style="background-image:url('${s.image_url}')"` : '';
  return `
    <div class="service-item">
      <div class="service-item-img" ${img}></div>
      <div class="service-item-body">
        <h4>${s.name}</h4>
        <p class="small text-secondary mb-1">${s.description || ''}</p>
        <span class="small text-body-tertiary"><i class="bi bi-stopwatch"></i> ${s.duration_minutes} นาที</span>
      </div>
      <div class="text-end">
        <div class="service-item-price">฿${formatMoney(s.price)}</div>
        <button class="btn btn-warning btn-sm mt-2" data-book="${s.id}">จองคิว</button>
      </div>
    </div>`;
}

function reviewItemHtml(r) {
  const d = new Date(r.created_at).toLocaleDateString('th-TH');
  return `
    <div class="review-card">
      <span class="stars">${starString(r.rating)}</span>
      <p class="mb-0">${r.comment || ''}</p>
      <div class="who">${r.profiles?.full_name || 'ลูกค้า'} · ${d}</div>
    </div>`;
}

function bookingWidgetHtml() {
  if (!services.length) {
    return `<h3>จองคิว</h3><p class="text-secondary mb-0">ร้านนี้ยังไม่มีบริการให้จอง</p>`;
  }
  if (!session) {
    return `<h3>จองคิว</h3><p class="text-secondary">เข้าสู่ระบบเพื่อจองคิวร้านนี้</p><a class="btn btn-primary w-100" href="login.html">เข้าสู่ระบบ</a>`;
  }
  if (profile?.role === 'seller') {
    return `<h3>จองคิว</h3><p class="text-secondary mb-0">บัญชีผู้ขายไม่สามารถจองคิวได้ กรุณาใช้บัญชีลูกค้า</p>`;
  }
  const today = new Date().toISOString().slice(0, 10);
  return `
    <h3>จองคิว</h3>
    <div id="bookingMsg"></div>
    <div class="mb-3">
      <label for="serviceSelect" class="form-label">เลือกบริการ</label>
      <select class="form-select" id="serviceSelect">
        ${services.map((s) => `<option value="${s.id}" ${s.id === selectedServiceId ? 'selected' : ''}>${s.name} — ฿${formatMoney(s.price)}</option>`).join('')}
      </select>
    </div>
    <div class="mb-3">
      <label for="bookingDate" class="form-label">วันที่</label>
      <input type="date" class="form-control" id="bookingDate" min="${today}" value="${today}" />
    </div>
    <div class="mb-3">
      <label class="form-label">เวลาที่ว่าง</label>
      <div class="slot-grid" id="slotGrid"><span class="form-text">กำลังโหลดเวลาว่าง...</span></div>
    </div>
    <div class="mb-3">
      <label for="bookingNote" class="form-label">หมายเหตุ (ถ้ามี)</label>
      <textarea class="form-control" id="bookingNote" rows="2" placeholder="เช่น ความต้องการพิเศษ"></textarea>
    </div>
    <button class="btn btn-primary w-100" id="submitBooking" disabled>เลือกเวลาก่อนจอง</button>
  `;
}

function attachBookingHandlers() {
  if (!session || profile?.role === 'seller' || !services.length) return;

  qs('#serviceSelect').addEventListener('change', (e) => {
    selectedServiceId = e.target.value;
    selectedTime = null;
    renderSlots();
  });
  qs('#bookingDate').addEventListener('change', () => {
    selectedTime = null;
    renderSlots();
  });
  qs('#submitBooking').addEventListener('click', submitBooking);

  renderSlots();
}

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function minutesToTime(m) {
  const h = Math.floor(m / 60).toString().padStart(2, '0');
  const mm = (m % 60).toString().padStart(2, '0');
  return `${h}:${mm}`;
}

async function renderSlots() {
  const grid = qs('#slotGrid');
  if (!grid) return;
  grid.innerHTML = '<span class="form-text">กำลังโหลดเวลาว่าง...</span>';

  const service = services.find((s) => s.id === selectedServiceId);
  const date = qs('#bookingDate').value;
  const duration = service?.duration_minutes || 60;
  const openMin = timeToMinutes(shop.open_time?.slice(0, 5) || '09:00');
  const closeMin = timeToMinutes(shop.close_time?.slice(0, 5) || '20:00');

  const slots = [];
  for (let t = openMin; t + duration <= closeMin; t += duration) {
    slots.push(minutesToTime(t));
  }

  const { data: existing } = await supabase
    .from('bookings')
    .select('booking_time, status')
    .eq('shop_id', shopId)
    .eq('booking_date', date)
    .neq('status', 'cancelled');

  const taken = new Set((existing || []).map((b) => b.booking_time.slice(0, 5)));

  if (!slots.length) {
    grid.innerHTML = '<span class="form-text">ไม่มีช่วงเวลาว่างสำหรับบริการนี้</span>';
    return;
  }

  grid.innerHTML = slots
    .map(
      (t) =>
        `<button type="button" class="slot-btn ${t === selectedTime ? 'selected' : ''}" data-time="${t}" ${taken.has(t) ? 'disabled' : ''}>${t}</button>`
    )
    .join('');

  grid.querySelectorAll('.slot-btn:not(:disabled)').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedTime = btn.dataset.time;
      grid.querySelectorAll('.slot-btn').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      const submitBtn = qs('#submitBooking');
      submitBtn.disabled = false;
      submitBtn.textContent = `จองเวลา ${selectedTime} น.`;
    });
  });
}

async function submitBooking() {
  const btn = qs('#submitBooking');
  const date = qs('#bookingDate').value;
  if (!selectedTime || !date) return;

  btn.disabled = true;
  btn.textContent = 'กำลังจอง...';

  const { error } = await supabase.from('bookings').insert({
    shop_id: shopId,
    service_id: selectedServiceId,
    customer_id: session.user.id,
    booking_date: date,
    booking_time: selectedTime,
    note: qs('#bookingNote').value.trim(),
    status: 'pending',
  });

  if (error) {
    if (error.code === '23505') {
      qs('#bookingMsg').innerHTML = `<div class="alert alert-warning">ขออภัย เวลานี้เพิ่งถูกลูกค้าคนอื่นจองไปเมื่อสักครู่ กรุณาเลือกเวลาอื่น</div>`;
      selectedTime = null;
      await renderSlots();
      btn.disabled = true;
      btn.textContent = 'เลือกเวลาก่อนจอง';
    } else {
      qs('#bookingMsg').innerHTML = `<div class="alert alert-danger">จองไม่สำเร็จ: ${error.message}</div>`;
      btn.disabled = false;
      btn.textContent = `จองเวลา ${selectedTime} น.`;
    }
    return;
  }

  qs('#bookingWidget').querySelector('.card-body').innerHTML = `
    <h3>จองสำเร็จ 🎉</h3>
    <p class="text-secondary">ร้านค้าจะยืนยันการจองของคุณเร็วๆ นี้ ติดตามสถานะได้ที่แดชบอร์ดของคุณ</p>
    <a class="btn btn-primary w-100" href="customer-dashboard.html">ดูการจองของฉัน</a>
  `;
}

load();