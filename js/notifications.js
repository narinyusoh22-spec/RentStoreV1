import { supabase } from './supabase-client.js';

export async function getUnreadCount(userId) {
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  return count || 0;
}

async function listNotifications(userId, limit = 15) {
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return data || [];
}

async function markAllRead(userId) {
  await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false);
}

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'เมื่อสักครู่';
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ชั่วโมงที่แล้ว`;
  return `${Math.floor(hrs / 24)} วันที่แล้ว`;
}

// mounts a notification bell (with unread badge + dropdown list) at the
// start of the given container. Called from auth.js's renderNav() for
// logged-in customers only, since only customers receive notifications today.
export async function renderNotificationBell(mountEl, session) {
  let unread = await getUnreadCount(session.user.id);

  const wrapper = document.createElement('div');
  wrapper.className = 'dropdown';
  wrapper.innerHTML = `
    <button class="btn btn-outline-secondary btn-sm position-relative" type="button" id="notifBell" data-bs-toggle="dropdown" aria-expanded="false">
      <i class="bi bi-bell"></i>
      <span class="badge rounded-pill bg-danger notif-badge ${unread ? '' : 'd-none'}" id="notifCount">${unread}</span>
    </button>
    <div class="dropdown-menu dropdown-menu-end p-0 notif-dropdown" aria-labelledby="notifBell">
      <div class="px-3 py-2 border-bottom fw-semibold">การแจ้งเตือน</div>
      <div id="notifList" class="notif-list">
        <div class="text-center text-secondary small py-4">กำลังโหลด...</div>
      </div>
    </div>
  `;
  mountEl.prepend(wrapper);

  const bellBtn = wrapper.querySelector('#notifBell');
  const badge = wrapper.querySelector('#notifCount');
  const list = wrapper.querySelector('#notifList');

  bellBtn.addEventListener('shown.bs.dropdown', async () => {
    const items = await listNotifications(session.user.id);
    list.innerHTML = items.length
      ? items
          .map(
            (n) => `
        <div class="notif-item ${n.is_read ? '' : 'unread'}">
          <div>${n.message}</div>
          <div class="notif-time">${timeAgo(n.created_at)}</div>
        </div>`
          )
          .join('')
      : `<div class="text-center text-secondary small py-4">ยังไม่มีการแจ้งเตือน</div>`;

    if (unread > 0) {
      await markAllRead(session.user.id);
      unread = 0;
      badge.classList.add('d-none');
      badge.textContent = '0';
    }
  });
}
