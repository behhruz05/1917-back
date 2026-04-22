# Xavfsizlik Vazifalari (Security Tasks)

---

## KRITIK — Darhol tuzatish kerak

### [x] 1. Parollarni bcrypt bilan hash qilish
- **Fayl:** `server.js` — `/register`, `/login`
- **Tuzatildi:** `bcrypt.hash(password, 10)` va `bcrypt.compare()` ishlatildi

### [x] 2. Mass Assignment zaifligini tuzatish
- **Fayl:** `server.js` — `/products/:id` PUT
- **Tuzatildi:** `req.body` o'rniga faqat `{ name, price, description, category }` uzatildi

### [x] 3. Rate Limiting qo'shish (Brute Force himoyasi)
- **Fayl:** `server.js`
- **Tuzatildi:** `express-rate-limit` — login: 15 daqiqada 10 urinish, register: 1 soatda 5 urinish

---

## YUQORI — Imkon boricha tezroq tuzatish

### [x] 4. Helmet — HTTP Xavfsizlik Headerlari
- **Fayl:** `server.js`
- **Tuzatildi:** `app.use(helmet())` qo'shildi

### [x] 5. CORS Sozlash
- **Fayl:** `server.js`
- **Tuzatildi:** `app.use(cors({ origin: process.env.CLIENT_URL }))` qo'shildi

### [x] 6. Access Token muddatini kamaytirish
- **Fayl:** `utils/generateTokens.js`
- **Tuzatildi:** `"1000m"` → `"15m"` ga o'zgartirildi

### [x] 7. Server xatolari ichki ma'lumot bermaydi
- **Fayl:** `server.js` — barcha `catch` bloklar
- **Tuzatildi:** `err.message` o'rniga `"Server xatosi"` qaytariladi, `console.error(err)` bilan loglanadi

---

## O'RTA — Keyingi iteratsiyada tuzatish

### [x] 8. Swagger-ni Productiondan yopish
- **Fayl:** `server.js`
- **Tuzatildi:** `if (process.env.NODE_ENV !== "production")` sharti qo'shildi

### [x] 9. Input Validation qo'shish
- **Fayl:** `middleware/validate.js` (yangi fayl)
- **Tuzatildi:** `joi` bilan register, login, product uchun schema validatsiya

### [x] 10. Refresh Token bazada saqlash
- **Fayl:** `model/refreshToken.model.js` (yangi), `server.js`
- **Tuzatildi:** `/refresh` va `/logout` endpointlar, DB-da saqlash, logout da o'chirish

---

## PAST — Yaxshi amaliyot sifatida

### [x] 11. `.env` faylini `.gitignore` ga qo'shish
- **Tuzatildi:** `.gitignore` yaratildi: `node_modules/` va `.env`

### [x] 12. `NODE_ENV` muhit o'zgaruvchisini qo'shish
- **Fayl:** `.env`
- **Tuzatildi:** `NODE_ENV=development`, `CLIENT_URL`, `PORT` qo'shildi

---

## Holat Jadvali

| # | Zaiflik | Xavf darajasi | Holat |
|---|---------|---------------|-------|
| 1 | Parol plain-text | KRITIK | [x] |
| 2 | Mass Assignment | KRITIK | [x] |
| 3 | Rate Limiting yo'q | KRITIK | [x] |
| 4 | Helmet yo'q | YUQORI | [x] |
| 5 | CORS sozlanmagan | YUQORI | [x] |
| 6 | Token muddati uzun | YUQORI | [x] |
| 7 | Server xato ma'lumoti | YUQORI | [x] |
| 8 | Swagger ochiq | O'RTA | [x] |
| 9 | Input validation yo'q | O'RTA | [x] |
| 10 | Refresh token saqlanmaydi | O'RTA | [x] |
| 11 | .gitignore yo'q | PAST | [x] |
| 12 | NODE_ENV yo'q | PAST | [x] |

---

## Yangi fayllar

| Fayl | Maqsad |
|------|--------|
| `model/refreshToken.model.js` | Refresh token DB modeli |
| `middleware/validate.js` | Joi input validatsiya |
| `.gitignore` | .env va node_modules-ni gitdan yashirish |
