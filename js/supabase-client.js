// =========================================================
//  Supabase client
//  1) ไปที่ Supabase Dashboard > Project Settings > API
//  2) คัดลอก "Project URL" และ "anon public" key มาวางแทนค่าด้านล่าง
// =========================================================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://sqvedwociszpewbqwzce.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxdmVkd29jaXN6cGV3YnF3emNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NDc5NjcsImV4cCI6MjA5OTMyMzk2N30.kLjrHbd27luXGpce49cwMEf1uJKhgjOnRb-yErUbPDM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// bucket name used for shop / service images (create this in Storage)
export const MEDIA_BUCKET = 'shop-media';

// ---------- small shared helpers used across pages ----------

export function qs(sel, root = document) {
  return root.querySelector(sel);
}

export function qsa(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}

export function formatDateThai(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  return { day: d.getDate(), month: months[d.getMonth()], full: `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}` };
}

export function formatTime(t) {
  if (!t) return '';
  return t.slice(0, 5);
}

export function formatMoney(n) {
  return Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 0 });
}

export function statusLabel(status) {
  const map = {
    pending: 'รอยืนยัน',
    confirmed: 'ยืนยันแล้ว',
    completed: 'เสร็จสิ้น',
    cancelled: 'ยกเลิกแล้ว',
  };
  return map[status] || status;
}

export function starString(rating) {
  const r = Math.round(rating || 0);
  return '★★★★★☆☆☆☆☆'.slice(5 - r, 10 - r);
}

export async function uploadImage(file, pathPrefix) {
  const ext = file.name.split('.').pop();
  const path = `${pathPrefix}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
