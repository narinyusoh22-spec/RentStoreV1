-- =========================================================
--  ระบบจองร้านค้าหลายประเภท (Multi-shop Booking System)
--  รันไฟล์นี้ทั้งหมดใน Supabase Dashboard > SQL Editor > New query
-- =========================================================

-- ---------- 1) PROFILES (ข้อมูลผู้ใช้ + สิทธิ์) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  phone text,
  role text not null default 'customer' check (role in ('customer', 'seller')),
  avatar_url text,
  created_at timestamptz not null default now()
);

-- ---------- 2) SHOPS (ร้านค้า) ----------
create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  category text not null default 'ทั่วไป',
  description text,
  address text,
  phone text,
  cover_url text,
  logo_url text,
  open_time time not null default '09:00',
  close_time time not null default '20:00',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- 3) SERVICES (บริการ / คิวที่จองได้) ----------
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  name text not null,
  description text,
  price numeric(10, 2) not null default 0,
  duration_minutes int not null default 60,
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- 4) BOOKINGS (รายการจอง) ----------
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  booking_date date not null,
  booking_time time not null,
  note text,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);

-- ---------- 5) REVIEWS (รีวิว/ให้คะแนน) ----------
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (booking_id)
);

-- ---------- 6) NOTIFICATIONS (แจ้งเตือนในแอป) ----------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  booking_id uuid references public.bookings (id) on delete cascade,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user on public.notifications (user_id, is_read);

-- ---------- 7) FAVORITES (ร้านโปรดของลูกค้า) ----------
create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  shop_id uuid not null references public.shops (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (customer_id, shop_id)
);

create index if not exists idx_favorites_customer on public.favorites (customer_id);

-- ---------- 8) WAITLIST (แจ้งเตือนเมื่อคิวว่างในวันที่ต้องการ) ----------
create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  preferred_date date not null,
  note text,
  status text not null default 'waiting' check (status in ('waiting', 'notified', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists idx_waitlist_shop_date on public.waitlist (shop_id, preferred_date, status);
create index if not exists idx_waitlist_customer on public.waitlist (customer_id);

-- เพิ่มคอลัมน์แต้มสะสม/จำนวนครั้งที่ใช้บริการสำเร็จ ให้ profiles (สำหรับระบบลูกค้าประจำ)
alter table public.profiles add column if not exists loyalty_points integer not null default 0;
alter table public.profiles add column if not exists completed_bookings_count integer not null default 0;

create index if not exists idx_shops_owner on public.shops (owner_id);
create index if not exists idx_services_shop on public.services (shop_id);
create index if not exists idx_bookings_shop on public.bookings (shop_id);
create index if not exists idx_bookings_customer on public.bookings (customer_id);
create index if not exists idx_reviews_shop on public.reviews (shop_id);

-- ป้องกันการจองซ้อนเวลาเดียวกันของร้านเดียวกัน (กันปัญหาลูกค้า 2 คนกดจองพร้อมกันพอดี)
-- นับเฉพาะรายการที่ยัง "active" อยู่ (ไม่รวมรายการที่ถูกยกเลิกแล้ว)
create unique index if not exists idx_bookings_unique_active_slot
  on public.bookings (shop_id, booking_date, booking_time)
  where status <> 'cancelled';

-- =========================================================
--  TRIGGER: สร้างแถวใน profiles อัตโนมัติเมื่อมีการสมัครสมาชิกใหม่
--  (อ่านค่า full_name / role / phone จาก metadata ที่ส่งตอน signUp)
-- =========================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', 'ผู้ใช้ใหม่'),
    coalesce(new.raw_user_meta_data ->> 'role', 'customer'),
    new.raw_user_meta_data ->> 'phone'
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =========================================================
--  TRIGGER: เมื่อสถานะการจองเปลี่ยน — แจ้งเตือนลูกค้า, ให้แต้มสะสมถ้าเสร็จสิ้น,
--  และแจ้งคิวรอ (waitlist) ถ้ามีคิวว่างจากการยกเลิก
-- =========================================================
create or replace function public.notify_booking_status_change()
returns trigger as $$
declare
  shop_name text;
  service_name text;
  status_text text;
  wl record;
begin
  if new.status = old.status then
    return new;
  end if;

  status_text := case new.status
    when 'confirmed' then 'ร้านยืนยันการจองของคุณแล้ว'
    when 'completed' then 'การจองของคุณเสร็จสิ้นแล้ว ให้คะแนนร้านได้เลย'
    when 'cancelled' then 'การจองของคุณถูกยกเลิก'
    else null
  end;

  select name into shop_name from public.shops where id = new.shop_id;
  select name into service_name from public.services where id = new.service_id;

  if status_text is not null then
    insert into public.notifications (user_id, booking_id, message)
    values (
      new.customer_id,
      new.id,
      status_text || ' — ' || coalesce(shop_name, 'ร้านค้า') || ' (' || coalesce(service_name, 'บริการ') || ')'
    );
  end if;

  -- ให้แต้มสะสม + นับจำนวนครั้งที่ใช้บริการสำเร็จ (ระบบลูกค้าประจำ)
  if new.status = 'completed' then
    update public.profiles
    set loyalty_points = loyalty_points + 10,
        completed_bookings_count = completed_bookings_count + 1
    where id = new.customer_id;
  end if;

  -- ถ้ายกเลิก แปลว่าอาจมีคิวว่างขึ้นมา แจ้งลูกค้าที่ลงชื่อรอคิว (waitlist) วันเดียวกัน ร้านเดียวกัน
  if new.status = 'cancelled' then
    for wl in
      select * from public.waitlist
      where shop_id = new.shop_id
        and preferred_date = new.booking_date
        and status = 'waiting'
    loop
      insert into public.notifications (user_id, booking_id, message)
      values (
        wl.customer_id,
        new.id,
        'มีคิวว่างแล้วที่ ' || coalesce(shop_name, 'ร้านค้า') || ' วันที่คุณรออยู่ รีบเข้าไปจองก่อนที่นั่งจะเต็มอีกครั้ง'
      );
      update public.waitlist set status = 'notified' where id = wl.id;
    end loop;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_booking_status_change on public.bookings;
create trigger on_booking_status_change
  after update on public.bookings
  for each row execute procedure public.notify_booking_status_change();

-- =========================================================
--  ROW LEVEL SECURITY
-- =========================================================
alter table public.profiles enable row level security;
alter table public.shops enable row level security;
alter table public.services enable row level security;
alter table public.bookings enable row level security;
alter table public.reviews enable row level security;
alter table public.notifications enable row level security;

-- ---- profiles ----
drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all" on public.profiles
  for select using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- ---- shops ----
drop policy if exists "shops_select_public" on public.shops;
create policy "shops_select_public" on public.shops
  for select using (is_active = true or owner_id = auth.uid());

drop policy if exists "shops_insert_seller" on public.shops;
create policy "shops_insert_seller" on public.shops
  for insert with check (
    owner_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'seller')
  );

drop policy if exists "shops_update_own" on public.shops;
create policy "shops_update_own" on public.shops
  for update using (owner_id = auth.uid());

drop policy if exists "shops_delete_own" on public.shops;
create policy "shops_delete_own" on public.shops
  for delete using (owner_id = auth.uid());

-- ---- services ----
drop policy if exists "services_select_public" on public.services;
create policy "services_select_public" on public.services
  for select using (true);

drop policy if exists "services_insert_owner" on public.services;
create policy "services_insert_owner" on public.services
  for insert with check (
    exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid())
  );

drop policy if exists "services_update_owner" on public.services;
create policy "services_update_owner" on public.services
  for update using (
    exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid())
  );

drop policy if exists "services_delete_owner" on public.services;
create policy "services_delete_owner" on public.services
  for delete using (
    exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid())
  );

-- ---- bookings ----
drop policy if exists "bookings_select_involved" on public.bookings;
create policy "bookings_select_involved" on public.bookings
  for select using (
    customer_id = auth.uid()
    or exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid())
  );

drop policy if exists "bookings_insert_customer" on public.bookings;
create policy "bookings_insert_customer" on public.bookings
  for insert with check (customer_id = auth.uid());

drop policy if exists "bookings_update_involved" on public.bookings;
create policy "bookings_update_involved" on public.bookings
  for update using (
    customer_id = auth.uid()
    or exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid())
  );

-- ---- reviews ----
drop policy if exists "reviews_select_public" on public.reviews;
create policy "reviews_select_public" on public.reviews
  for select using (true);

drop policy if exists "reviews_insert_customer" on public.reviews;
create policy "reviews_insert_customer" on public.reviews
  for insert with check (
    customer_id = auth.uid()
    and exists (
      select 1 from public.bookings b
      where b.id = booking_id and b.customer_id = auth.uid() and b.status = 'completed'
    )
  );

-- ---- notifications ----
-- ไม่มี insert policy ให้ผู้ใช้ทั่วไป เพราะแถวถูกสร้างผ่าน trigger (security definer) เท่านั้น
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
  for select using (user_id = auth.uid());

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
  for update using (user_id = auth.uid());

-- ---- favorites ----
alter table public.favorites enable row level security;

drop policy if exists "favorites_select_own" on public.favorites;
create policy "favorites_select_own" on public.favorites
  for select using (customer_id = auth.uid());

drop policy if exists "favorites_insert_own" on public.favorites;
create policy "favorites_insert_own" on public.favorites
  for insert with check (customer_id = auth.uid());

drop policy if exists "favorites_delete_own" on public.favorites;
create policy "favorites_delete_own" on public.favorites
  for delete using (customer_id = auth.uid());

-- ---- waitlist ----
alter table public.waitlist enable row level security;

drop policy if exists "waitlist_select_involved" on public.waitlist;
create policy "waitlist_select_involved" on public.waitlist
  for select using (
    customer_id = auth.uid()
    or exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid())
  );

drop policy if exists "waitlist_insert_own" on public.waitlist;
create policy "waitlist_insert_own" on public.waitlist
  for insert with check (customer_id = auth.uid());

drop policy if exists "waitlist_update_own" on public.waitlist;
create policy "waitlist_update_own" on public.waitlist
  for update using (customer_id = auth.uid());

-- =========================================================
--  STORAGE: bucket สำหรับรูปภาพร้าน/บริการ
--  ไปสร้าง bucket ชื่อ "shop-media" (Public bucket) ที่หน้า Storage ก่อน
--  แล้วค่อยรันคำสั่งด้านล่างนี้เพื่อกำหนดสิทธิ์
-- =========================================================
drop policy if exists "shop_media_public_read" on storage.objects;
create policy "shop_media_public_read" on storage.objects
  for select using (bucket_id = 'shop-media');

drop policy if exists "shop_media_auth_upload" on storage.objects;
create policy "shop_media_auth_upload" on storage.objects
  for insert with check (bucket_id = 'shop-media' and auth.role() = 'authenticated');

drop policy if exists "shop_media_auth_update" on storage.objects;
create policy "shop_media_auth_update" on storage.objects
  for update using (bucket_id = 'shop-media' and auth.role() = 'authenticated');

drop policy if exists "shop_media_auth_delete" on storage.objects;
create policy "shop_media_auth_delete" on storage.objects
  for delete using (bucket_id = 'shop-media' and auth.role() = 'authenticated');

-- บังคับขนาดไฟล์และชนิดไฟล์ที่ระดับ bucket จริงๆ (ฝั่งเซิร์ฟเวอร์)
-- ต้องรันหลังจากสร้าง bucket "shop-media" แล้วเท่านั้น ไม่งั้นจะไม่มีผลอะไร (0 rows updated)
update storage.buckets
set file_size_limit = 5242880, -- 5MB เป็นไบต์
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
where id = 'shop-media';

-- เสร็จแล้ว! ระบบพร้อมใช้งาน