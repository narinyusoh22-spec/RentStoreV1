import { supabase, qs, formatMoney } from './supabase-client.js';
import { renderNav, getSessionAndProfile } from './auth.js';
import { getFavoriteShopIds, toggleFavorite } from './favorites.js';

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
let session = null;
let profile = null;
let favoriteIds = new Set();

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

  // fetch ratings + total booking counts (social proof) for the visible shops
  const shopIds = shops.map((s) => s.id);
  const [{ data: reviews }, { data: bookingsCount }] = await Promise.all([
    supabase.from('reviews').select('shop_id, rating').in('shop_id', shopIds),
    supabase.from('bookings').select('shop_id').in('shop_id', shopIds).neq('status', 'cancelled'),
  ]);
  const ratingByShop = {};
  (reviews || []).forEach((r) => {
    if (!ratingByShop[r.shop_id]) ratingByShop[r.shop_id] = [];
    ratingByShop[r.shop_id].push(r.rating);
  });
  const bookingCountByShop = {};
  (bookingsCount || []).forEach((b) => {
    bookingCountByShop[b.shop_id] = (bookingCountByShop[b.shop_id] || 0) + 1;
  });

  const canFavorite = session && profile?.role === 'customer';

  grid.innerHTML = shops
    .map((s, i) => {
      const list = ratingByShop[s.id] || [];
      const avg = list.length ? (list.reduce((a, b) => a + b, 0) / list.length).toFixed(1) : null;
      const img = s.cover_url ? `style="background-image:url('${s.cover_url}')"` : '';
      const bookedCount = bookingCountByShop[s.id] || 0;
      const isFav = favoriteIds.has(s.id);
      // small stagger so cards revealed together don't all pop in at once
      const delay = (i % 6) * 0.06;
      return `
      <div class="col">
        <a class="shop-card" href="shop.html?id=${s.id}" style="--reveal-delay:${delay}s">
          <div class="shop-card-img" ${img}>
            ${s.cover_url ? '' : s.name.slice(0, 1)}
            ${canFavorite ? `<button type="button" class="fav-btn ${isFav ? 'active' : ''}" data-fav="${s.id}" aria-label="บันทึกร้านโปรด"><i class="bi ${isFav ? 'bi-heart-fill' : 'bi-heart'}"></i></button>` : ''}
            ${bookedCount >= 3 ? `<span class="urgency-badge"><i class="bi bi-fire"></i> จองแล้ว ${bookedCount} ครั้ง</span>` : ''}
          </div>
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

  observeCardReveal();
  attachFavoriteHandlers();
}

function attachFavoriteHandlers() {
  document.querySelectorAll('[data-fav]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const shopId = btn.dataset.fav;
      const icon = btn.querySelector('i');
      btn.disabled = true;
      try {
        const nowFav = await toggleFavorite(session.user.id, shopId, favoriteIds.has(shopId));
        if (nowFav) {
          favoriteIds.add(shopId);
          btn.classList.add('active');
          icon.className = 'bi bi-heart-fill';
        } else {
          favoriteIds.delete(shopId);
          btn.classList.remove('active');
          icon.className = 'bi bi-heart';
        }
      } catch (err) {
        alert('บันทึกร้านโปรดไม่สำเร็จ: ' + err.message);
      } finally {
        btn.disabled = false;
      }
    });
  });
}

// reveals each shop-card with a fade/slide-up transition as it scrolls into
// view, instead of animating everything at once on page load
function observeCardReveal() {
  const cards = document.querySelectorAll('#shopGrid .shop-card');
  if (!('IntersectionObserver' in window)) {
    cards.forEach((c) => c.classList.add('in-view'));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
  );
  cards.forEach((c) => observer.observe(c));
}

qs('#searchForm').addEventListener('submit', (e) => {
  e.preventDefault();
  searchTerm = qs('#searchInput').value.trim();
  loadShops();
});

renderChips();

(async () => {
  const auth = await getSessionAndProfile();
  session = auth.session;
  profile = auth.profile;
  if (session && profile?.role === 'customer') {
    favoriteIds = await getFavoriteShopIds(session.user.id);
  }
  loadShops();
})();