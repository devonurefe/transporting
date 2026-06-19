# HuurGo Deployment Capacity Analysis (2026)

**Hazırlandı:** 18 Haziran 2026  
**Sistem:** HuurGo Makine Kiralama Platformu (Dutch B2B)  
**Konum:** MB Hoogwerkers B.V., Zoeterwoude  
**Hedef:** Kapasite senaryoları ve 1 yıl büyüme projeksiyonu

---

## 📊 Executive Summary

**Mevcut State:**
- **Makine Parkı:** 30 aktif makine (9 kategori)
- **Ortalama Günlük Fiyat:** €80-120 (makine tipine göre)
- **Sistem Mimarisi:** Single-package React + Express, PostgreSQL, Render deploy
- **Halihazır Kapasite:** ~200 eşzamanlı makine-günü/ay

**1 Yıl Sonra Senaryosu (2x Parkı → 60 Makine):**
- **Tahmini Aylık Ciro:** €120K-€320K (kapasite seviyesine göre)
- **Sistem Load:** Veritabanı bağlantı havuzu, API rate limiting, ve caching optimizasyonları gerekli
- **Deployment:** Render PostgreSQL `connection_limit=10&pool_timeout=20` tavsiye edilmiş (CLAUDE.md'de belirtilmiş)

---

## 🏗️ Mevcut Makine Parkı (30 Birim)

| Kategori | Makine | Adet | €/Gün | Haftalık | Aylık |
|----------|--------|------|-------|----------|-------|
| **Aanhanger** | Nifty 120 | 3 | €95 | €335 | €490 |
| | Nifty 170 | 1 | €120 | €430 | €590 |
| **Spinhoogwerker** | Hinowa 15.70 | 1 | €200 | €750 | €1.100 |
| | Hinowa 17.75 | 1 | €250 | €920 | €1.350 |
| **Schaarlift 8m** | Optimum/Compact | 4 | €65 | €159 | €420 |
| **Schaarlift 10m** | Compact 10N | 2 | €89 | €215 | €580 |
| **Schaarlift 6m** | Dingli 6m | 1 | €49 | €120 | €340 |
| **Kamersteiger** | Altrex RS44 | 1 | €19/hafta | €19 | *weekly-only* |
| **Mastlift** | Star 10, SJ16, Bravi, JLG | 4 | €45-95 | €110-260 | €320-690 |
| **Ladderlift** | 18m, 21m (×2) | 3 | €89-110 | €290-360 | — |
| **Pecolift** | — | 1 | €39 | €99 | €290 |
| **TOPLAM** | — | **30** | **~€80 avg** | — | — |

**Notlar:**
- Fiyatlandırma: flat-rate sistemi (weekendPrice, weeklyPrice, monthlyPrice) kullanılmakta
- Kamersteiger: haftalık-only, self-pickup only (loss leader: €19/hafta)
- Transport ücretleri: Delivery €150 (flat), trailer €25/gün, self-pickup free

---

## 💰 Finansal Projeksiyonlar

### Senaryolar

**Kullanım Yüzdesi:** Makine parkında kaç % rezervasyon/gün
- **30% Kapasite:** Aylık ~60 günlük kiralama (= 30 makine × 30 gün × %20 avg)
- **60% Kapasite:** Aylık ~120 günlük kiralama (40% avg)
- **100% Kapasite:** Aylık ~180 günlük kiralama (60% avg)

---

### Senaryo 1: %30 Kapasite (Güvenli Seviye)

**Mevcut Parkı (30 Makine):**

```
Varsayımlar:
- Ortalama kiralama: 5 gün/rezervasyon
- Ortalama makine fiyatı: €90/gün (weighted avg)
- Aylık rezervasyon sayısı: ~30-40
- Transport: %60 delivery (€150/res), %40 self-pickup

Aylık Hesaplama:
  - Makine geliri: 30 makineler × 30 gün × 30% × €90 = €81.000
  - Transport +: 30 rez × €150 × 60% = €2.700
  - Transport -: 30 rez × €25/gün × 3 gün × 40% = €900
  
  Brüt Ciro: ~€82.000-€84.000/ay
  
Yıllık: €984.000-€1.008.000
```

**Kar Tahmini (Operasyon Maliyetleri):**
- Bakım + sigorta: ~€3.000-€4.000/ay (makine başına ~€100-€130)
- İnsan kaynakları: 1-2 kişi admin (~€3.000-€4.000)
- Hosting (Render + PostgreSQL): ~€150-€200/ay
- Email (Resend): ~€50-€100/ay
- **Net Kar:** ~€75.000-€76.000/ay (**~€900K/yıl**)

---

### Senaryo 2: %60 Kapasite (Yüksek Talep)

**Mevcut Parkı (30 Makine):**

```
Varsayımlar:
- Ortalama kiralama: 4 gün/rezervasyon (tekrar sıklığı artar)
- Aylık rezervasyon sayısı: ~60-70
- Transport yüzde aynı

Aylık:
  - Makine geliri: 30 × 30 × 60% × €90 = €162.000
  - Transport: ~€4.800
  
  Brüt Ciro: ~€166.800/ay
  
Yıllık: ~€2.001.600
```

**Kar (aynı işletme maliyetleriyle):**
- **Net Kar:** ~€155.000-€160.000/ay (**~€1.86M/yıl**)

---

### Senaryo 3: %100 Kapasite (Maksimum)

**Mevcut Parkı (30 Makine):**

```
Varsayımlar:
- Ortalama kiralama: 3.5 gün/rezervasyon (short-term bookings increase)
- Aylık rezervasyon sayısı: ~100-110
- Bazı makineler rotasyon süresi < 1 gün (high churn)

Aylık:
  - Makine geliri: 30 × 30 × 100% × €90 = €270.000
  - Transport: ~€7.200
  
  Brüt Ciro: ~€277.200/ay
  
Yıllık: ~€3.326.400
```

**Kar:**
- Ek maliyet: Maintenance + cleaning (~€1.500/ay daha), extra admin (~€1.500)
- **Net Kar:** ~€250.000-€270.000/ay (**~€3.06M/yıl**)

---

## 📈 Tahmin: 1 Yıl Sonra (+2x Parkı = 60 Makine)

Mevcut parkı **katlama** (60 makine = +30 yeni unit):
- Capital: ~€400K-€600K makine satın alımı
- Operasyon: +€5K-€7K/ay bakım, +€2K-€3K insan kaynakları

---

### +2x Parkı, %30 Kapasite

```
Brüt Ciro: 60 × 30 × 30% × €90 = €162.000/ay
Yıllık: ~€1.944.000
```

---

### +2x Parkı, %60 Kapasite

```
Brüt Ciro: 60 × 30 × 60% × €90 = €324.000/ay
Yıllık: ~€3.888.000
```

---

### +2x Parkı, %100 Kapasite

```
Brüt Ciro: 60 × 30 × 100% × €90 = €540.000/ay
Yıllık: ~€6.480.000
```

**Kar Tahmini (+2x Parkı):**
- Makine bakım: ~€10K/ay
- İnsan kaynakları: 4-5 kişi (~€20K/ay)
- Hosting / sistem: ~€500-€1K/ay (scaling)
- **Net Kar @100% Kapasite:** ~€500K-€510K/ay (**~€6M/yıl**)

---

## 🔧 Deployment & Teknik Gereksinimler

### Mevcut Setup (Production Ready)
- **Node.js Express** single-process
- **React SPA** (Vite build)
- **PostgreSQL** (Render managed)
- **Rate Limiting:** 300 req/min global, 10 attempts/15 min auth
- **Auth:** JWT, bcrypt
- **Email:** Resend (transactional)
- **Security:** Helmet, CORS, CSP, HSTS, frameguard

### Gerekli Scaling Yükseltmeleri

#### A. Database Layer (%60 → %100 Kapasite)

**Sorun:** Eşzamanlı bağlantı tıkanıklığı (peak hours)

**Çözüm:**
```env
DATABASE_URL=postgresql://...?connection_limit=10&pool_timeout=20
```
- ✅ Zaten CLAUDE.md'de tavsiye edilmiş
- Prisma connection pooling: 10 concurrent, timeout 20s
- **Render:** Managed PostgreSQL → automatic backups, SSL

**Ek Optimizasyonlar:**
```sql
-- Existing (zaten seed'de var):
CREATE INDEX ON "Order" ("machineId", "startDate", "endDate", "status");
CREATE INDEX ON "BlockedDate" ("machineId", "date");
CREATE INDEX ON "Order" ("createdAt");

-- %100 Kapasite için ADD:
CREATE INDEX ON "Order" ("customerId");
CREATE INDEX ON "Order" ("status");
```

---

#### B. Caching Layer

**Kullanılmamış şu an** → %60+ kapasite için MANDATORY

**Önerilen: Redis (in-memory cache)**

```
Cached Data:
- Machine catalog (invalidate: admin update)
- Blocked dates (invalidate: real-time)
- Site config (invalidate: admin update)
- Order status (invalidate: per-order-update)
- Availability check (invalidate: per-day midnight)
```

**Implementasyon (pseudo):**
```javascript
// server.ts
import redis from "redis";
const cache = redis.createClient({ url: process.env.REDIS_URL });

// Availability endpoint (hottest)
app.get("/api/machines/availability", async (req, res) => {
  const key = `avail:${machineId}:${startDate}:${endDate}`;
  const cached = await cache.get(key);
  if (cached) return res.json(JSON.parse(cached));
  
  const result = checkAvailability(...);
  await cache.setex(key, 3600, JSON.stringify(result)); // 1h TTL
  res.json(result);
});
```

**Provider:** 
- **Local Dev:** `docker-compose add redis service`
- **Render:** Redis add-on (~€7/mo basic tier)
- **Alternative:** Upstash (serverless Redis, pay-per-request)

---

#### C. API Gateway / Load Balancing

**Mevcut:** Render single dyno (auto-scaling via load average)

**%100 Kapasite için:**
```
Option 1: Render Horizontal Scaling
  - Enable "Scale to multiple dynos" in Render settings
  - Auto-scale 1→4 dynos on CPU/memory threshold
  - Cost: €29/dyno/mo (standard) × 4 = €116+

Option 2: Cloudflare Workers (edge caching)
  - Cache availability queries at edge (100+ locations)
  - Reduce round-trip time: 300ms → 50ms
  - Cost: €20/mo + usage

Option 3: Quad9 / Akamai (not needed at this scale)
```

---

#### D. Monitoring & Logging

**Eksik şu an** (CRITICAL for 60+ makine)

**Önerilen Stack:**
```
1. Request Logger (zaten var: server/middleware/logger.js)
   - Extend to: response time, error rates
   
2. Application Metrics (yeni gerek)
   - npm: prometheus-client
   - Export: /metrics endpoint
   
3. Alert & Dashboard
   - Sentry (error tracking): €29/mo
   - Datadog Lite (metrics): €15/mo
   - CloudWatch (if AWS): built-in
   - Render Logs: built-in, search limited
   
4. Uptime Monitoring
   - Uptime Robot (free): 5-min checks
   - StatusPage.io: status dashboard for customers
```

**Implementasyon (Sentry example):**
```javascript
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: isProd ? 0.1 : 1.0, // 10% in prod
  environment: process.env.NODE_ENV
});

app.use(Sentry.Handlers.requestHandler());
app.use(errorHandler); // custom
app.use(Sentry.Handlers.errorHandler());
```

---

#### E. Database Backup & Disaster Recovery

**Mevcut:** Render PostgreSQL (automated daily snapshots, 7 days retention)

**%100 Kapasite için:**
```
CRITICAL:
- Enable point-in-time recovery (PITR): 7 days
- Test restore procedure monthly
- Cost: included in Render PostgreSQL

OPTIONAL:
- Cross-region backup: Render EU → US backup bucket (Wasabi S3 ~€10/mo)
- Real-time replication: not needed at this scale
```

---

#### F. API Rate Limiting Tuning

**Mevcut (seed.ts'de örnek var):**
```javascript
const limiter = rateLimit({
  windowMs: 60 * 1000,        // 1 minute
  max: 300,                   // 300 req/min = 5 req/sec
  message: "Te veel verzoeken..."
});
app.use("/api/", limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 min
  max: 10,                     // brute-force protection
  message: "Te veel inlogpogingen..."
});
app.use("/api/auth", authLimiter);
```

**%100 Kapasite için Ayarlama:**
```javascript
// Increase global burst capacity
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 600,                  // 600 → 10 req/sec
  skipSuccessfulRequests: false,
  keyGenerator: (req) => req.ip  // per-IP, not per-user
});

// Endpoint-specific limits for expensive operations
const availabilityLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,                  // availability checks more permissive
  skip: (req) => req.user && req.user.role === "admin"  // admin exempt
});
app.get("/api/machines/availability", availabilityLimiter, ...);
```

---

## 📋 Feature Roadmap (1 Yıl Growth)

### Tier 1: %30 → %60 (Q1-Q2 2027)
- ✅ Redis caching (availability, catalog)
- ✅ Database indexes (Orders.customerId, .status)
- ✅ Sentry error tracking
- ✅ Uptime monitoring (Uptime Robot)
- Estimate: **€200/mo added ops cost**

### Tier 2: %60 → %100 (Q2-Q3 2027)
- ✅ Horizontal scaling (Render multi-dyno)
- ✅ Cloudflare Workers (edge cache)
- ✅ Advanced metrics (Datadog or Prometheus)
- ✅ Real-time notifications (WebSocket or polling improvement)
- ✅ Admin dashboard KPI upgrades (more granular filters)
- Estimate: **€500/mo added ops cost**

### Tier 3: Post-2027 (Optionally)
- API v2 (versioning for mobile app)
- Mobile native app (React Native: iOS + Android)
- SMS notifications (Twilio for urgent updates)
- iCal feed improvements (now at `/api/calendar/<token>/huurgo.ics`, expand to sync)
- Third-party integrations (Twinfield ERP API expansion)

---

## 🔐 Security Checklist (Growth Phase)

| İtem | Mevcut | %60 Kapasite | %100 Kapasite |
|------|--------|-------------|---------------|
| **HSTS** | ✅ (prod) | ✅ | ✅ |
| **CSP** | ✅ (prod) | ✅ + review | ✅ + edge cache |
| **Rate Limiting** | ✅ 300/min | ✅ 600/min | ✅ + per-endpoint |
| **JWT Expiry** | ✅ 7d | ✅ 7d | ⚠️ consider 24h |
| **Password Policy** | ✅ bcrypt | ✅ | ⚠️ 2FA recommended |
| **Audit Logging** | 🟡 basic (adminLogs) | ✅ enhanced | ✅ + intrusion detection |
| **DB Encryption** | ✅ (Render SSL) | ✅ | ✅ |
| **Backup Testing** | 🟡 manual | ✅ monthly test | ✅ automated test |

---

## 📞 Operasyon Staffing

| Kapasite | FTE Admin | FTE Developer | Cost/Mo |
|----------|-----------|---------------|---------|
| **%30 (Current)** | 1-2 | 0.5 | €3.000-€4.000 |
| **%60** | 2-3 | 1 | €6.000-€8.000 |
| **%100** | 3-4 | 1.5 | €10.000-€12.000 |

---

## 🚀 Render Deploy Optimization

**Mevcut build script (`package.json`):**
```json
{
  "build": "npm run clean && prisma generate && vite build && esbuild server.ts ...",
  "start": "prisma db push && node dist/server.js"
}
```

**Önerilen Render `render.yaml`:**
```yaml
services:
  - type: web
    name: huurgo-app
    env: node
    buildCommand: npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: huurgo-db
          property: connectionString
        suffix: "?connection_limit=10&pool_timeout=20"
    scaling:
      minInstances: 1
      maxInstances: 4
      targetMemoryPercent: 70
      targetCPUPercent: 70
  
  - type: pserv
    name: huurgo-db
    ipAllowList: []
    dbName: huurgo
    user: huurgo_user

  - type: redis
    name: huurgo-cache
    plan: starter  # €7/mo
    ipAllowList: []
```

---

## 💡 Ek Öneriler

### 1. Cron Job: Daily Reminder Email
**Mevcut:** ✅ Scheduled at 07:00 daily
- Risk at scale: Email queue backlog if Resend rate-limited
- **Fix:** Implement queue (Bull/RabbitMQ) for %100 scenario

### 2. Order Lifecycle Automation
**Mevcut:** Manual admin status updates
- **Improvement:** Auto-transition "In behandeling" → "Geannuleerd" after 48h unpaid
- Already flagged in admin UI (orange warning)

### 3. Invoice Numbering
**Mevcut:** `InvoiceCounter` model tracks sequence
- Works fine up to millions
- Add: Invoice archive (annual cleanup, soft-delete)

### 4. Availability Algorithm
**Mevcut:** `src/utils/availability.ts` → O(1) blocked-date lookup, client-side
- Scales to 1000-day window easily
- **At scale:** Consider server-side caching (24h TTL per machine-date)

### 5. Multi-language (i18n)
**Mevcut:** nl-NL, en-US, tr-TR via Zustand store
- Server errors hardcoded Dutch
- **For scale:** Centralize translation keys server-side

---

## 📊 Summary Table: Kapasite vs Ciro vs Maliyet

| Metrik | %30 (Now) | %60 | %100 | +2x %30 | +2x %60 | +2x %100 |
|--------|-----------|-----|------|---------|---------|----------|
| **Makine** | 30 | 30 | 30 | 60 | 60 | 60 |
| **Aylık Ciro** | €82K | €167K | €277K | €162K | €324K | €540K |
| **Yıllık** | €984K | €2M | €3.3M | €1.9M | €3.9M | €6.5M |
| **Op Cost/Mo** | €8.5K | €10K | €12.5K | €16K | €19K | €24K |
| **Net Kar/Mo** | €73K | €157K | €265K | €146K | €305K | €516K |
| **Net Kar/Yıl** | €900K | €1.9M | €3.1M | €1.75M | €3.7M | €6.2M |
| **System Changes** | Baseline | +Redis | +LB | Initial | +Cache | +Scale |

---

## 🎯 Action Items (Next 3 Months)

### Phase 1: Foundation (Aylık €200-300 cost)
- [ ] Redis ekle (Render add-on veya Upstash)
- [ ] Database indexes oluştur (customerId, status)
- [ ] Sentry integration
- [ ] Prometheus metrics export
- [ ] Uptime Robot (free) setup

### Phase 2: Monitoring (Aylık €50-100 cost)
- [ ] Datadog Lite dashboard
- [ ] Email alerts (Sentry + Datadog)
- [ ] Monthly backup restore test

### Phase 3: Load Testing
- [ ] `npm run load-test` (k6 or locust) → 100 concurrent users
- [ ] Availability endpoint peak load test
- [ ] Database query performance audit

---

## Kaynaklar

- **CLAUDE.md:** Project conventions, seed safety, security
- **server.ts:** Helmet, CORS, rate limiting config
- **src/utils/availability.ts:** Client-side availability logic
- **Render Docs:** https://render.com/docs
- **Prisma Scaling:** https://www.prisma.io/docs/orm/more/help-center/production/connection-management

---

**Son Güncelleme:** 18 Haziran 2026  
**Hazırlayan:** Claude Code Deployment Analysis  
**Onay:** Gerçekleştirilmeden önce MB Hoogwerkers operasyon ekibiyle gözden geçirin.
