import { supabase, qs, qsa, formatDateThai, formatTime, formatMoney, statusLabel } from './supabase-client.js';
import { requireRole, renderNav } from './auth.js';

renderNav();

let session, bookings = [], reviewedBookingIds = new Set();
let reviewModal, currentBookingId = null, currentShopId = null, currentRating = 5;

(async () => {
  const auth = await requireRole('customer');
  if (!auth) return;
  session = auth.session;
  reviewModal = new bootstrap.Modal(qs('#reviewModal'));
  await load();
})();

async function load() {
  const { data, error } = await supabase
    .from('bookings')
    .select('*, shops:shop_id(name), services:service_id(name, price)')
    .eq('customer_id', session.user.id)
    .order('booking_date', { ascending: true })
    .order('booking_time', { ascending: true });

  if (error) {
    qs('#upcomingList').innerHTML = `<div class="empty-state">โหลดข้อมูลไม่สำเร็จ: ${error.message}</div>`;
    return;
  }

  bookings = data || [];

  const { data: myReviews } = await supabase
    .from('reviews')
    .select('booking_id')
    .eq('customer_id', session.user.id);
  reviewedBookingIds = new Set((myReviews || []).map((r) => r.booking_id));

  render();
}

function render() {
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = bookings.filter((b) => ['pending', 'confirmed'].includes(b.status) && b.booking_date >= today);
  const history = bookings.filter((b) => !upcoming.includes(b));

  qs('#upcomingList').innerHTML = upcoming.length
    ? upcoming.map((b) => ticketHtml(b, true)).join('')
    : `<div class="empty-state"><div class="icon">📅</div>ยังไม่มีการจองที่กำลังจะถึง<br><a class="btn btn-primary mt-3" href="index.html">ค้นหาร้านเพื่อจอง</a></div>`;

  qs('#historyList').innerHTML = history.length
    ? history.map((b) => ticketHtml(b, false)).join('')
    : `<div class="empty-state"><div class="icon">🗂️</div>ยังไม่มีประวัติการจอง</div>`;

  attachActions();
}

function ticketHtml(b, isUpcoming) {
  const d = formatDateThai(b.booking_date);
  const canCancel = isUpcoming;
  const canReview = b.status === 'completed' && !reviewedBookingIds.has(b.id);
  return `
    <div class="ticket">
      <div class="ticket-main">
        <div class="ticket-shop">${b.shops?.name || 'ร้านค้า'}</div>
        <div class="ticket-service">${b.services?.name || 'บริการ'}</div>
        <div class="ticket-meta">
          <span>฿${formatMoney(b.services?.price)}</span>
          <span class="badge badge-${b.status}">${statusLabel(b.status)}</span>
        </div>
        ${b.note ? `<p class="small mt-2 mb-0">หมายเหตุ: ${b.note}</p>` : ''}
        <div class="ticket-actions">
          ${canCancel ? `<button class="btn btn-outline-danger btn-sm" data-cancel="${b.id}">ยกเลิกการจอง</button>` : ''}
          ${canReview ? `<button class="btn btn-warning btn-sm" data-review="${b.id}" data-shop="${b.shop_id}">ให้คะแนนร้าน</button>` : ''}
        </div>
      </div>
      <div class="ticket-stub">
        <div class="day">${d.day}</div>
        <div class="month">${d.month}</div>
        <div class="time">${formatTime(b.booking_time)}</div>
      </div>
    </div>`;
}

function attachActions() {
  qsa('[data-cancel]').forEach((btn) => {
    btn.addEventListener('click', () => cancelBooking(btn.dataset.cancel));
  });
  qsa('[data-review]').forEach((btn) => {
    btn.addEventListener('click', () => openReviewModal(btn.dataset.review, btn.dataset.shop));
  });
}

async function cancelBooking(id) {
  if (!confirm('ยืนยันยกเลิกการจองนี้หรือไม่?')) return;
  const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id);
  if (error) {
    alert('ยกเลิกไม่สำเร็จ: ' + error.message);
    return;
  }
  await load();
}

function renderStars() {
  qs('#starInput').innerHTML = [1, 2, 3, 4, 5]
    .map((n) => `<span data-star="${n}" class="${n <= currentRating ? 'active' : ''}">★</span>`)
    .join('');
  qsa('#starInput span').forEach((s) => {
    s.addEventListener('click', () => {
      currentRating = Number(s.dataset.star);
      renderStars();
    });
  });
}

function openReviewModal(bookingId, shopId) {
  currentBookingId = bookingId;
  currentShopId = shopId;
  currentRating = 5;
  qs('#reviewComment').value = '';
  qs('#reviewMsg').innerHTML = '';
  renderStars();
  reviewModal.show();
}

qs('#submitReview').addEventListener('click', async () => {
  const btn = qs('#submitReview');
  btn.disabled = true;
  const { error } = await supabase.from('reviews').insert({
    shop_id: currentShopId,
    booking_id: currentBookingId,
    customer_id: session.user.id,
    rating: currentRating,
    comment: qs('#reviewComment').value.trim(),
  });
  btn.disabled = false;
  if (error) {
    qs('#reviewMsg').innerHTML = `<div class="alert alert-danger">ส่งรีวิวไม่สำเร็จ: ${error.message}</div>`;
    return;
  }
  reviewModal.hide();
  await load();
});
