# จองคิว — ระบบจองร้านค้าหลายประเภท (Supabase + Bootstrap 5)

ระบบจองคิวแบบยืดหยุ่น ใช้ได้กับร้านหลายประเภท (ร้านเสริมสวย คลินิก ร้านอาหาร ฟิตเนส ฯลฯ)
แยกโค้ด HTML / CSS / JavaScript ล้วน ไม่มี build step
ใช้ **Bootstrap 5.3** (โหลดผ่าน CDN) เป็นเฟรมเวิร์กหน้าตา + responsive grid/navbar/modal/tabs
และใช้ [Supabase](https://supabase.com) เป็นฐานข้อมูล + ระบบ Auth

มี 2 บทบาท:
- **ลูกค้า (customer)** — ค้นหาร้าน จองคิว ดูประวัติการจอง ยกเลิก ให้คะแนนรีวิว
- **ผู้ขาย (seller)** — เปิดร้าน จัดการบริการ (พร้อมรูปภาพ) จัดการรายการจอง (ยืนยัน/เสร็จสิ้น/ยกเลิก) ดูแดชบอร์ดสรุปยอดและรีวิว

## เกี่ยวกับ Bootstrap 5 ในโปรเจกต์นี้

ทุกหน้าโหลด Bootstrap CSS/JS และ Bootstrap Icons ผ่าน CDN ไม่ต้องติดตั้งอะไรเพิ่ม:

```html
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css" rel="stylesheet">
...
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
```

`css/style.css` ถูกโหลด **หลัง** Bootstrap เสมอ และทำหน้าที่เป็น "ธีม" — มัน override ตัวแปรสีของ Bootstrap
(`--bs-primary`, `--bs-warning`, `--bs-danger`, ฟอนต์ `--bs-body-font-family` ฯลฯ) ให้เป็นโทนสีเขียวป่า/ส้มเหลืองและฟอนต์ไทย
ของแบรนด์นี้ ดังนั้นคอมโพเนนต์มาตรฐานของ Bootstrap ทั้งหมด (ปุ่ม, badge, form, navbar, modal, nav-pills, table)
จะได้หน้าตาที่เข้าธีมโดยอัตโนมัติ โดยไม่ต้องเขียน CSS ทับทีละคอมโพเนนต์

ส่วนที่ Bootstrap ไม่มีให้ (เช่น การ์ดจองคิวทรงตั๋ว, ช่องเลือกเวลาว่าง, ช่องอัปโหลดรูป) เขียนเป็นคลาสเสริมเองใน
`css/style.css` และ `css/dashboard.css`

ฟีเจอร์ Bootstrap ที่ใช้จริงในระบบ: **Navbar** (responsive พร้อมเมนูแฮมเบอร์เกอร์บนมือถือ), **Nav pills / Tab content**
(แท็บในหน้า login และแดชบอร์ด), **Modal** (ป๊อปอัปให้รีวิวและเพิ่ม/แก้ไขบริการ), **Grid system** (row/col ทุกหน้า),
**Forms**, **Table**, **Badge**, **Alert**

## โครงสร้างไฟล์

```
booking-system/
├── index.html              หน้าแรก ค้นหา/เลือกดูร้านค้า
├── login.html               เข้าสู่ระบบ / สมัครสมาชิก (เลือกบทบาท)
├── shop.html                รายละเอียดร้าน + จองคิว + รีวิว
├── register-shop.html       ฟอร์มเปิดร้าน (สำหรับผู้ขาย)
├── seller-dashboard.html    แดชบอร์ดผู้ขาย (ภาพรวม/จัดการร้าน/บริการ/รายการจอง/รีวิว)
├── customer-dashboard.html  แดชบอร์ดลูกค้า (การจองของฉัน)
├── css/
│   ├── style.css             ธีมทับ Bootstrap + ดีไซน์โทเคน + คอมโพเนนต์เฉพาะ (ตั๋วจอง ฯลฯ)
│   └── dashboard.css         สไตล์เฉพาะหน้าแดชบอร์ด (stat card, service row, ช่องอัปโหลดรูป)
├── js/
│   ├── supabase-client.js    ตั้งค่า Supabase client + ฟังก์ชันช่วยเหลือ
│   ├── auth.js                สมัคร/เข้าสู่ระบบ/ออกจากระบบ + navbar
│   ├── shops.js                หน้าแรก
│   ├── login.js                หน้า login/register
│   ├── register-shop.js        ฟอร์มเปิดร้าน
│   ├── shop-detail.js          รายละเอียดร้าน + จองคิว
│   ├── seller-dashboard.js     แดชบอร์ดผู้ขาย
│   └── customer-dashboard.js   แดชบอร์ดลูกค้า
└── sql/
    └── schema.sql             ตาราง, trigger, Row Level Security ทั้งหมด
```

## ขั้นตอนตั้งค่า Supabase (ทำครั้งเดียว)

### 1. สร้างโปรเจกต์
ไปที่ [supabase.com](https://supabase.com) → New Project → ตั้งชื่อ/รหัสผ่านฐานข้อมูล → รอสักครู่จนโปรเจกต์พร้อมใช้งาน

### 2. รันสคีมาฐานข้อมูล
เปิด **SQL Editor** (เมนูซ้าย) → New query → คัดลอกเนื้อหาทั้งหมดจากไฟล์ `sql/schema.sql` → วาง → กด **Run**

สคีมานี้จะสร้างให้อัตโนมัติ:
- ตาราง `profiles`, `shops`, `services`, `bookings`, `reviews`
- Trigger ที่สร้างแถว `profiles` อัตโนมัติทุกครั้งที่มีคนสมัครสมาชิก (อ่าน role/ชื่อ/เบอร์จากฟอร์มสมัคร)
- Row Level Security (RLS) ครบทุกตาราง เช่น ลูกค้าเห็น/แก้ไขได้เฉพาะการจองของตัวเอง ผู้ขายเห็น/แก้ไขได้เฉพาะร้านและการจองของร้านตัวเอง

### 3. สร้าง Storage bucket สำหรับรูปภาพ
ไปที่เมนู **Storage** → New bucket → ตั้งชื่อ `shop-media` → เปิด **Public bucket** → Create

จากนั้นกลับไปที่ **SQL Editor** แล้วรันส่วน STORAGE POLICIES ที่อยู่ท้ายไฟล์ `sql/schema.sql` (ถ้ารันทั้งไฟล์ไปแล้วรอบเดียวก็ไม่ต้องรันซ้ำ)

### 4. คัดลอก API Key มาใส่ในโค้ด
ไปที่ **Project Settings > API** คัดลอก:
- `Project URL`
- `anon public` key

แล้วเปิดไฟล์ `js/supabase-client.js` แก้ไข 2 บรรทัดนี้:

```js
const SUPABASE_URL = 'https://YOUR-PROJECT-REF.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR-ANON-PUBLIC-KEY';
```

### 5. (แนะนำสำหรับทดสอบ) ปิดการยืนยันอีเมล
ไปที่ **Authentication > Providers > Email** → ปิด **Confirm email**
วิธีนี้ทำให้สมัครสมาชิกแล้วเข้าใช้งานได้ทันทีโดยไม่ต้องกดยืนยันในอีเมล (เหมาะกับการทดสอบ ก่อน deploy จริงค่อยเปิดกลับ)

## วิธีรันโปรเจกต์

ไฟล์ JavaScript ใช้ ES Modules (`import`/`export`) จึงต้องเปิดผ่านเว็บเซิร์ฟเวอร์ ไม่สามารถดับเบิลคลิกเปิดไฟล์ตรงๆ ได้ (เบราว์เซอร์จะบล็อก CORS)

วิธีง่ายที่สุด เลือกอย่างใดอย่างหนึ่ง:

```bash
# ถ้ามี Python
cd booking-system
python3 -m http.server 8080
# แล้วเปิด http://localhost:8080

# หรือถ้ามี Node.js
npx serve booking-system
```

หรือใช้ส่วนขยาย **Live Server** ใน VS Code ก็ได้เช่นกัน

## ทดสอบระบบ

1. เปิด `index.html` → สมัครสมาชิกที่ `login.html` เลือกบทบาท **ผู้ขาย** → ระบบจะพาไปหน้าเปิดร้าน (`register-shop.html`) → กรอกข้อมูลร้าน
2. ในแดชบอร์ดผู้ขาย ไปแท็บ **บริการ** → เพิ่มบริการอย่างน้อย 1 รายการ (ใส่ราคา/ระยะเวลา/รูปได้)
3. เปิดเบราว์เซอร์อีกแท็บ (หรือโหมดไม่ระบุตัวตน) สมัครสมาชิกใหม่เป็น **ลูกค้า** → ค้นหาร้านที่หน้าแรก → เข้าไปจองคิว
4. กลับไปที่บัญชีผู้ขาย → แท็บ **รายการจอง** → กด "ยืนยัน" จากนั้น "เสร็จสิ้น" เพื่อจำลองการให้บริการเสร็จ
5. กลับไปบัญชีลูกค้า → แดชบอร์ดลูกค้า → แท็บ "ประวัติการจอง" → กด "ให้คะแนนร้าน"

## หมายเหตุ / ข้อจำกัดของ MVP นี้

- ผู้ขาย 1 บัญชี = 1 ร้าน (ถ้าต้องการหลายร้านต่อบัญชี ต้องปรับ query ในหน้าแดชบอร์ดให้เลือกร้านได้)
- ช่วงเวลาจองคำนวณจากเวลาเปิด-ปิดร้านและระยะเวลาบริการ ยังไม่รองรับวันหยุด/พักเที่ยงเฉพาะวัน
- การชำระเงินยังไม่รวมอยู่ในระบบนี้ (จองแล้วชำระที่ร้าน) — ถ้าต้องการเพิ่ม สามารถต่อยอดด้วย Stripe/Omise ในขั้นตอนจองได้
- ทุกการเชื่อมต่อฐานข้อมูลเรียกตรงจากฝั่ง browser ผ่าน Supabase anon key + RLS ซึ่งปลอดภัยตราบใดที่ policy ใน `schema.sql` ไม่ถูกแก้ให้หลวมลง
