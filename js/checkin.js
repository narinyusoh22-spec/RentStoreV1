import { supabase, qs, formatDateThai, formatTime, formatMoney, statusLabel } from './supabase-client.js';
import { requireLogin, renderNav } from './auth.js';

renderNav();

const params = new URLSearchParams(window.location.search);
const bookingId = params.get('booking');
const root = qs('#checkinRoot');

if (!bookingId) {
  root.innerHTML = `<div class="empty-state">ลิงก์เช็คอินไม่ถูกต้อง</div>`;
  throw new Error('missing booking id');
}

(async () => {
  const auth = await requireLogin();
  if (!auth) return;
  const { session, profile } = auth;

  if (profile?.role !== 'seller') {
    root.innerHTML = `<div class="empty-state">หน้านี้สำหรับผู้ขายใช้เช็คอินลูกค้าเท่านั้น</div>`;
    return;
  }

  const { data: booking, error } = await supabase
    .from('bookings')
    .select('*, shops:shop_id(name, owner_id), services:service_id(name, price), profiles:customer_id(full_name, phone)')
    .eq('id', bookingId)
    .single();

  if (error || !booking) {
    root.innerHTML = `<div class="empty-state">ไม่พบการจองนี้</div>`;
    return;
  }

  if (booking.shops?.owner_id !== session.user.id) {
    root.innerHTML = `<div class="empty-state">การจองนี้ไม่ได้อยู่ในร้านของคุณ</div>`;
    return;
  }

  render(booking);
})();

function render(b) {
  const d = formatDateThai(b.booking_date);
  const canConfirmVisit = b.status === 'confirmed';

  root.innerHTML = `
    <div class="card border-0 shadow-sm">
      <div class="card-body p-4 text-center">
        <div class="mb-2"><span class="badge badge-${b.status}">${statusLabel(b.status)}</span></div>
        <h3 class="mb-0">${b.services?.name || 'บริการ'}</h3>
        <p class="text-secondary mb-3">${b.shops?.name || ''}</p>
        <div class="d-flex justify-content-center gap-4 mb-3 small text-secondary">
          <span><i class="bi bi-calendar3"></i> ${d.full}</span>
          <span><i class="bi bi-clock"></i> ${formatTime(b.booking_time)} น.</span>
        </div>
        <div class="mb-3">
          <strong>${b.profiles?.full_name || 'ลูกค้า'}</strong><br>
          <span class="text-secondary small">${b.profiles?.phone || ''}</span>
        </div>
        <div class="mb-4 fw-semibold">฿${formatMoney(b.services?.price)}</div>
        <div id="checkinMsg"></div>
        ${
          canConfirmVisit
            ? `<button class="btn btn-primary w-100" id="confirmVisitBtn"><i class="bi bi-check2-circle"></i> ยืนยันลูกค้ามาถึง / เสร็จสิ้นบริการ</button>`
            : `<p class="text-secondary small mb-0">การจองนี้ไม่ได้อยู่ในสถานะที่เช็คอินได้ (ต้องเป็น "ยืนยันแล้ว" เท่านั้น)</p>`
        }
      </div>
    </div>
  `;

  qs('#confirmVisitBtn')?.addEventListener('click', async () => {
    const btn = qs('#confirmVisitBtn');
    btn.disabled = true;
    btn.textContent = 'กำลังบันทึก...';
    const { error } = await supabase.from('bookings').update({ status: 'completed' }).eq('id', b.id);
    if (error) {
      qs('#checkinMsg').innerHTML = `<div class="alert alert-danger">เช็คอินไม่สำเร็จ: ${error.message}</div>`;
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-check2-circle"></i> ยืนยันลูกค้ามาถึง / เสร็จสิ้นบริการ';
      return;
    }
    b.status = 'completed';
    render(b);
  });
}
