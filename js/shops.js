import { supabase, qs, formatMoney } from './supabase-client.js';
import { renderNav } from './auth.js';

renderNav();

const CATEGORIES = [
  'ทั้งหมด',
  'ความงาม & สปา',
  'สุขภาพ & คลินิก',
  'ร้านอาหาร & คาเฟ่',
  'ฟิตเนส & กีฬา',
  'การศึกษา & ติวเตอร์',
  'ยานยนต์',
  'บริการทั่วไป',
];

const CATEGORY_ICONS = {
  'ทั้งหมด': 'bi-grid-fill',
  'ความงาม & สปา': 'bi-flower2',
  'สุขภาพ & คลินิก': 'bi-heart-pulse-fill',
  'ร้านอาหาร & คาเฟ่': 'bi-cup-hot-fill',
  'ฟิตเนส & กีฬา': 'bi-lightning-charge-fill',
  'การศึกษา & ติวเตอร์': 'bi-mortarboard-fill',
  'ยานยนต์': 'bi-car-front-fill',
  'บริการทั่วไป': 'bi-tools',
};

let activeCategory = 'ทั้งหมด';
let searchTerm = '';

function renderChips() {
  const wrap = qs('#categoryChips');
  wrap.innerHTML = CATEGORIES.map(
    (c) => `
      <button type="button" class="cat-chip ${c === activeCategory ? 'active' : ''}" data-cat="${c}" title="${c}" aria-label="${c}">
        <span class="cat-chip-icon"><i class="bi ${CATEGORY_ICONS[c] || 'bi-shop'}"></i></span>
        <span class="cat-chip-label">${c}</span>
      </button>`
  ).join('');
  wrap.querySelectorAll('.cat-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeCategory = btn.dataset.cat;
      renderChips();
      loadShops();
    });
  });
}

async function loadShops() {
  const grid = qs('#shopGrid');
  grid.innerHTML = '<div class="loader">กำลังโหลดร้านค้า...</div>';

  let query = supabase
    .from('shops')
    .select('id, name, category, cover_url, address')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (activeCategory !== 'ทั้งหมด') query = query.eq('category', activeCategory);
  if (searchTerm) query = query.ilike('name', `%${searchTerm}%`);

  const { data: shops, error } = await query;

  if (error) {
    grid.innerHTML = `<div class="empty-state">โหลดข้อมูลไม่สำเร็จ: ${error.message}</div>`;
    return;
  }

  qs('#resultCount').textContent = shops.length ? `พบ ${shops.length} ร้าน` : '';

  if (!shops.length) {
    grid.innerHTML = `<div class="empty-state"><div class="icon">🔍</div>ยังไม่พบร้านค้าในหมวดนี้</div>`;
    return;
  }

  // fetch ratings for the visible shops in one query
  const shopIds = shops.map((s) => s.id);
  const { data: reviews } = await supabase.from('reviews').select('shop_id, rating').in('shop_id', shopIds);
  const ratingByShop = {};
  (reviews || []).forEach((r) => {
    if (!ratingByShop[r.shop_id]) ratingByShop[r.shop_id] = [];
    ratingByShop[r.shop_id].push(r.rating);
  });

  grid.innerHTML = shops
    .map((s) => {
      const list = ratingByShop[s.id] || [];
      const avg = list.length ? (list.reduce((a, b) => a + b, 0) / list.length).toFixed(1) : null;
      const img = s.cover_url ? `style="background-image:url('${s.cover_url}')"` : '';
      return `
      <div class="col">
        <a class="shop-card" href="shop.html?id=${s.id}">
          <div class="shop-card-img" ${img}>${s.cover_url ? '' : s.name.slice(0, 1)}</div>
          <div class="shop-card-body">
            <span class="shop-card-cat">${s.category}</span>
            <span class="shop-card-name">${s.name}</span>
            <p class="small text-secondary mb-2">${s.address || ''}</p>
            <div>
              ${avg ? `<span class="stars">★</span> <span class="rating-num">${avg}</span> <span class="text-secondary small">(${list.length})</span>` : '<span class="text-secondary small">ยังไม่มีรีวิว</span>'}
            </div>
          </div>
        </a>
      </div>`;
    })
    .join('');
}

qs('#searchForm').addEventListener('submit', (e) => {
  e.preventDefault();
  searchTerm = qs('#searchInput').value.trim();
  loadShops();
});

renderChips();
loadShops();