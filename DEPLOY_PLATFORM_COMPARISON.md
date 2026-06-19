# Deploy Platform Comparison (HuurGo İçin)

**Hazırlandı:** 19 Haziran 2026  
**Hedef:** Sürdürülebilir, hands-off, müşteri-ready platform seçimi

---

## 🎯 Senin Gereksinim

✅ **Hands-off:** Git push → deployed (her ay konfigüre etme)  
✅ **Database included:** PostgreSQL ayrıca kurma yok  
✅ **Auto-scaling:** 0-100 customer aralığında auto adjust  
✅ **Backup auto:** Kendim backup script yazma  
✅ **SSL auto:** Sertifikat renewals otomatik  
✅ **Customer model:** "Ücretsiz başlayıp ödemeye geç" yapabileceğin  
✅ **Transparent pricing:** Ne dahil, ne değil clear  

---

## 📊 TÜM SEÇENEKLER - DETAYLX KARŞILAŞTIRMA

### 1️⃣ RAILWAY (railway.com/pricing)

```
┌─ FREE TIER ─────────────────────────────────────┐
│ ✅ €5 credit/month (free forever)              │
│ ✅ Node.js app + PostgreSQL fits in €5          │
│ ✅ SSL, custom domain, github auto-deploy       │
│ ✅ Auto-scaling included                        │
│ └─ Typical HuurGo: €4-6/month (within free)    │
│                                                 │
├─ PAID (Şu an pahalı hale gelirse)              │
│ ✅ Pay-as-you-go (€0.000208/CPU-hour)          │
│ ✅ Database: €2-3/mo (shared)                  │
│ └─ Scaling: Linear with usage                  │
│                                                 │
├─ DAHIL ✅                                       │
│ • Node.js runtime                              │
│ • PostgreSQL (included in free credit)         │
│ • SSL certificate (auto, Let's Encrypt)        │
│ • Custom domain                                │
│ • GitHub auto-deploy                           │
│ • Auto-restart on crash                        │
│ • Environment variables                        │
│ • Build logs, deploy logs                      │
│ • Basic monitoring (memory, CPU)               │
│                                                 │
├─ DAHIL DEĞİL ❌                                 │
│ ✗ Database backups (schedule manual)           │
│ ✗ Automated database backups                   │
│ ✗ PITR (point-in-time restore)                │
│ ✗ Uptime monitoring/alerts                     │
│ ✗ APM (application performance monitoring)     │
│ ✗ DDoS protection (basic only)                 │
│ ✗ 24/7 support (community)                     │
│                                                 │
└─ TOPLAM COST (REALISTIC)                       │
  Year 1: €60 (€5 × 12)                          │
  Year 2+: €120-240/year (scaling arttıkça)     │
  = €10-20/mo average                            │
```

**Railway Özet:**
- 🟢 **En ucuz, hands-off**
- 🟡 **Backups manual** (kritik)
- 🟡 **Küçük platform** (AWS/Azure kadar stabil değil)

---

### 2️⃣ RENDER (render.com/pricing)

```
┌─ FREE TIER ─────────────────────────────────────┐
│ ❌ €0/mo (512MB RAM, spindown!)                │
│ ⚠️  Production'a uygun DEĞİL                    │
│                                                 │
├─ PAID PLANS                                    │
│ Starter:   €6.50/mo  (512MB RAM, 0.5 CPU)     │
│ Standard:  €23/mo    (2GB RAM, 1 CPU) ← min   │
│ Pro:       €80/mo    (4GB RAM, 2 CPU)         │
│ Pro Plus:  €175/mo   (8GB RAM, 4 CPU)         │
│ Pro Ultra: €450/mo   (32GB RAM, 8 CPU)        │
│                                                 │
├─ DATABASE (SCP - Postgres as a Service)       │
│ Starter:   €9/mo     (256MB, 1GB storage)     │
│ Standard:  €15/mo    (1GB, 10GB storage)      │
│ Pro:       €45/mo    (4GB, 50GB)              │
│ └─ HuurGo need: €15/mo (Standard)             │
│                                                 │
├─ MINIMUM HuurGo SETUP                         │
│ App: €23/mo (Standard)                        │
│ DB:  €15/mo (Standard)                        │
│ = €38/mo (€456/year)                          │
│                                                 │
├─ DAHIL ✅ (App + Database)                      │
│ • Node.js + React SPA build                    │
│ • PostgreSQL (managed)                         │
│ • SSL (auto, Let's Encrypt)                    │
│ • Custom domain                                │
│ • GitHub auto-deploy                          │
│ • Horizontal scaling (1→4 dynos)               │
│ • Database backups (daily, 7-day PITR)         │
│ • Automated database backups                   │
│ • Point-in-time restore (PITR)                │
│ • Database snapshots                          │
│ • Monitoring (CPU, memory, disk)              │
│ • Health checks                               │
│ • Environment variables                       │
│ • Build logs, deploy logs, runtime logs       │
│ • Basic analytics                             │
│ • Zero-downtime deploys                       │
│                                                 │
├─ DAHIL DEĞİL ❌                                 │
│ ✗ Uptime monitoring/alerts (Uptime Robot)    │
│ ✗ APM beyond basic monitoring                │
│ ✗ DDoS protection (basic only)                │
│ ✗ Premium support (email support only)        │
│ ✗ SLA (not guaranteed)                        │
│                                                 │
└─ TOPLAM COST                                  │
  Year 1: €456 (€38 × 12)                       │
  Year 2+: €456-600 (scaling with dynos)        │
  = €38-50/mo                                   │
```

**Render Özet:**
- 🟢 **Most trusted** (Heroku successor)
- 🟢 **Database backups auto + PITR**
- 🟢 **Zero-downtime scaling**
- 🔴 **Most expensive** (€456/year)
- 🟢 **Mevcut HuurGo zaten burada!**

---

### 3️⃣ HETZNER (hetzner.com - VPS)

```
┌─ SHARED VPS (Intel/ARM)                       │
│ CPX11:   €4.90/mo   (2 vCPU, 4GB RAM, 40GB)  │
│ CPX21:   €9.40/mo   (4 vCPU, 8GB RAM, 80GB)  │
│ CPX31:   €16.90/mo  (8 vCPU, 16GB RAM, 160GB)│
│                                                 │
├─ + DATABASE (ayrı kurmalı!)                   │
│ PostgreSQL self-managed (Docker): €0          │
│ BUT: Backup script, maintenance = 20h setup   │
│                                                 │
├─ + MONITORING (ayrı kurmalı!)                 │
│ Uptime Robot: Free tier                       │
│ Prometheus/Grafana: €0 (senden kurmak)        │
│                                                 │
├─ MINIMUM HuurGo SETUP                         │
│ VPS: €4.90/mo (CPX11, 2vCPU/4GB)             │
│ DB: €0 (Docker, senden yönetim)              │
│ Backup: €0 (manual cron script)               │
│ = €4.90/mo BASE                               │
│ + €5/mo Backblaze B2 (secure backup)          │
│ = €9.90/mo (€119/year)                        │
│                                                 │
├─ DAHIL ✅                                       │
│ • 2 vCPU (or more)                            │
│ • 4-16 GB RAM                                 │
│ • 40-160 GB SSD                               │
│ • Root access (full control)                  │
│ • SSH key auth                                │
│ • DDoS protection (basic, free)               │
│ • Reverse DNS                                 │
│ • 1 vServer setup per month (free)            │
│ • Traffic (unlimited!)                        │
│                                                 │
├─ DAHIL DEĞİL ❌ (Senden yapmalı)               │
│ ✗ Operating system updates (apt upgrade)     │
│ ✗ Firewall config (UFW/iptables)             │
│ ✗ SSL certificate (Let's Encrypt + Certbot)  │
│ ✗ Reverse proxy (Nginx/Apache config)        │
│ ✗ Docker / Docker Compose setup              │
│ ✗ PostgreSQL installation & config           │
│ ✗ Database backups (cron script senden)      │
│ ✗ Monitoring setup (Prometheus, etc.)        │
│ ✗ Log aggregation (ELK stack optional)       │
│ ✗ Auto-scaling (manual new VPS buy)          │
│ ✗ Zero-downtime deploys (manual load balance)│
│ ✗ SSL renewal automation (Certbot hooks)     │
│ ✗ Health checks / monitoring (Uptime Robot) │
│                                                 │
└─ TOPLAM COST (REALISTIC)                      │
  Raw: €119/year (VPS + backup storage)         │
  + DevOps time: 20h setup + 3-5h/mo = €4K/yr │
  = €4,119/year TOTAL (internal cost!)          │
```

**Hetzner Özet:**
- 🟢 **En ucuz raw fiyat** (€4.90/mo)
- 🟡 **ÇOK SETUP GEREK** (20+ saat)
- 🟡 **Monthly maintenance** (3-5 saat/ay)
- 🔴 **Self-managed risk** (misconfiguration)
- 🔴 **No auto-scaling** (yeni VPS + load balancer)
- 🟢 **Full control** (tüm konfigürasyon senin)

---

### 4️⃣ DIGITALOCEAN (digitalocean.com)

```
┌─ APP PLATFORM (managed)                       │
│ $0.01 per app hour (shared container)         │
│ Typical HuurGo app: €2-3/mo                   │
│                                                 │
├─ DATABASE (PostgreSQL managed)                │
│ Starter: €15/mo (1GB mem, 25GB disk)         │
│ Standard: €25/mo (2GB mem, 100GB)            │
│ │                                              │
│ HuurGo need: €15/mo (Starter)                │
│                                                 │
├─ MINIMUM SETUP                                │
│ App: €3/mo                                    │
│ DB:  €15/mo                                   │
│ = €18/mo (€216/year)                         │
│                                                 │
├─ DAHIL ✅                                       │
│ • Node.js + React build                       │
│ • PostgreSQL (managed)                        │
│ • SSL (auto, Let's Encrypt)                   │
│ • Custom domain                               │
│ • GitHub auto-deploy                         │
│ • Database automatic backups                  │
│ • 7-day backup retention                      │
│ • Point-in-time restore                       │
│ • Monitoring (basic)                          │
│ • Log streaming                               │
│ • Environment variables                       │
│ • Auto-restart                                │
│                                                 │
├─ DAHIL DEĞİL ❌                                 │
│ ✗ Horizontal scaling (manual, costly)         │
│ ✗ APM monitoring                              │
│ ✗ DDoS protection (paid add-on)               │
│ ✗ 24/7 support (email/chat only)             │
│ └─ Limited free tier (not for production)    │
│                                                 │
└─ TOPLAM COST                                  │
  Year 1: €216/year                             │
  Year 2+: €216-350/year (scaling)              │
  = €18-30/mo                                   │
```

**DigitalOcean Özet:**
- 🟢 **Ucuz + managed database**
- 🟢 **PostgreSQL backups auto**
- 🟡 **App Platform limited scaling**
- 🟢 **Droplets alternatifi de var** (€4-6/mo, self-managed)

---

### 5️⃣ FLY.IO (fly.io)

```
┌─ COMPUTE (Shared CPU)                         │
│ 3x shared-cpu-1x free tier:                   │
│ - 3 GB RAM total (1GB each)                  │
│ - 3 GB storage                                │
│ - 160GB bandwidth/mo                          │
│                                                 │
├─ DATABASE (PostgreSQL + Redis)                │
│ Free tier:                                    │
│ - PostgreSQL 256MB (free!)                   │
│ - Redis 1GB (free!)                          │
│                                                 │
├─ MINIMUM SETUP (FREE TIER)                    │
│ App: €0 (within free)                        │
│ DB:  €0 (within free)                        │
│ = €0/mo (!!)                                 │
│                                                 │
│ When scaling beyond free:                     │
│ App: €5-15/mo                                │
│ DB:  €5-15/mo                                │
│ = €10-30/mo                                  │
│                                                 │
├─ DAHIL ✅ (Free Tier)                          │
│ • 3 shared-cpu-1x containers                  │
│ • PostgreSQL 256MB (shared)                   │
│ • Redis 1GB (shared)                          │
│ • SSL (auto, Let's Encrypt)                   │
│ • Custom domain                               │
│ • GitHub auto-deploy                         │
│ • Global edge deployment (11 regions)        │
│ • Environment variables                       │
│ • Health checks                               │
│ • Monitoring (basic)                          │
│ • Bandwidth: 160GB/mo                        │
│                                                 │
├─ DAHIL DEĞİL ❌                                 │
│ ✗ Database backups (paid: €7/mo)             │
│ ✗ Uptime SLA (not guaranteed)                │
│ ✗ Premium support                            │
│ ✗ DDoS protection (basic)                    │
│ ✗ APM monitoring                             │
│                                                 │
└─ TOPLAM COST                                  │
  Year 1: €0-60 (free tier + minor overages)   │
  Year 2+: €120-300 (with backups + scaling)   │
  = €0-25/mo                                   │
```

**Fly.io Özet:**
- 🟢 **Eternal free tier** (€0!)
- 🟢 **Database included**
- 🟡 **Backups paid** (€7/mo)
- 🟢 **Global edge deployment**
- 🟡 **Smaller platform** (Render'dan daha risky)

---

### 6️⃣ ORACLE CLOUD (oracle.com - Always Free)

```
┌─ COMPUTE (ARM Ampere A1)                      │
│ 4 OCPU + 24 GB RAM (always free!)            │
│ = 2 vCPU equivalent, massively powerful      │
│                                                 │
├─ DATABASE (PostgreSQL)                        │
│ 20GB managed PostgreSQL (free!)               │
│ Automatic backups included                   │
│                                                 │
├─ NETWORK                                      │
│ 10 Mbps in/out (free)                        │
│ 10 TB/mo outbound (free)                     │
│                                                 │
├─ MINIMUM SETUP                                │
│ App: €0                                       │
│ DB:  €0                                       │
│ = €0/mo FOREVER (!!)                         │
│                                                 │
├─ CATCH ⚠️                                      │
│ • Architecture: ARM64 (some apps need x86)  │
│ • Setup: 4-6 saat (Oracle UI complex)        │
│ • Limits: Fair-use (won't kick off <budget) │
│                                                 │
├─ DAHIL ✅                                       │
│ • 4 OCPU ARM (24GB RAM = HUGE!)              │
│ • 20GB managed PostgreSQL                    │
│ • Automatic backups                          │
│ • SSL (auto)                                 │
│ • VCN (virtual network)                      │
│ • Monitoring (basic)                         │
│ • Load balancer (free!)                      │
│ • 10TB/mo outbound bandwidth                 │
│                                                 │
├─ DAHIL DEĞİL ❌                                 │
│ ✗ Premium support                            │
│ ✗ Advanced monitoring/APM                    │
│ ✗ DDoS protection (advanced)                 │
│                                                 │
└─ TOPLAM COST                                  │
  Year 1: €0                                    │
  Year 2+: €0 (forever free tier!)              │
  = €0/mo FOREVER ✅                            │
```

**Oracle Cloud Özet:**
- 🟢 **ETERNAL FREE** (€0/year forever!)
- 🟢 **24GB RAM** (enterprise grade!)
- 🟡 **ARM64 (Dockerfile test needed)**
- 🟡 **Complex UI** (4-6h setup)
- 🟢 **Database + backups included**

---

## 📊 KARŞILAŞTIRMA TABLOSU

| Feature | Railway | Render | Hetzner | DigitalOcean | Fly.io | Oracle |
|---------|---------|--------|---------|--------------|--------|--------|
| **Monthly Cost** | €5-20 | €38-50 | €5-15 | €18-30 | €0-25 | €0 ♾️ |
| **Setup Time** | 30 min | 30 min | 20h+ | 45 min | 45 min | 4-6h |
| **Monthly Maint.** | 0h | 0h | 3-5h | 0h | 0h | 0.5h |
| **Database Included** | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| **Auto Backups** | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ |
| **PITR Restore** | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ |
| **Auto-scaling** | ✅ | ✅ | ❌ | 🟡 Limited | ✅ | ✅ |
| **SSL Auto** | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| **GitHub Deploy** | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| **Hands-off** | ✅ | ✅ | ❌ | ✅ | ✅ | 🟡 |
| **Customer-ready** | ✅ | ✅ | ❌ | ✅ | ✅ | 🟡 |
| **Stability** | 🟡 | 🟢 | 🟢 | 🟢 | 🟡 | 🟢 |

---

## 🎯 NEDEN POSTGRESQL AYRI?

**Temel pricing model:**
```
Most platforms = Compute + Storage separate pricing

Çünkü:
  - CPU/RAM usage ≠ Database usage
  - Database needs backup, PITR (extra cost)
  - Database needs different infrastructure
  - Company wants flexible pricing

Örnek Render:
  - App (dyno): €23/mo = compute + memory
  - Database: €15/mo = storage + backup + PITR
  
Sonuç: İkisini ayrı ödüyorsun ama ikiside managed
```

**Tüm platform'da:**
- Railway: Database free tier'da included (credits'te)
- Render: Ayrı öde (tüm yönetim dahil)
- Hetzner: Senden kurul (€0, ama 20h work)
- DigitalOcean: Ayrı öde (managed)
- Fly.io: Free tier'da included (limit 256MB)
- Oracle: Ayrı satır ama free forever

---

## 💰 TOPLAM MALIYET (12 AY)

| Platform | Year 1 | Year 2 | Setup | Maint/mo | TOTAL Cost |
|----------|--------|--------|-------|----------|-----------|
| **Railway** | €60-120 | €120-240 | 30min | 0h | €180-360 |
| **Render** | €456 | €456-600 | 30min | 0h | €456 |
| **Hetzner** | €119 | €119 | 20h | 3-5h | €119 + €4K labor |
| **DigitalOcean** | €216 | €216-350 | 45min | 0h | €216-350 |
| **Fly.io** | €0-60 | €120-300 | 45min | 0h | €120-360 |
| **Oracle Cloud** | €0 | €0 ♾️ | 4-6h | 0.5h | €0 |

---

## 🚀 ÖNERİ: SU AN NE VAR, NE OLMALI?

### **Şu Anki Durum (HuurGo)**

```
Render FREE tier'da (€0)
  ✅ €0 cost
  ❌ Spindown risk (idle 15 min → sleep)
  ❌ Production'a uygun değil
  
+ PostgreSQL self-managed μ (Docker local)
  ✅ €0 cost (local)
  ❌ No backup strategy
  ❌ No auto-restore
```

### **NE OLMALI?**

**Seçenek A: Render Standard (Safe, Proven)**
```
Render Standard: €23/mo
Render PostgreSQL: €15/mo
TOTAL: €38/mo (€456/year)

+ Already deployed there (just upgrade)
+ Auto backups, PITR, zero-downtime scaling
+ Most enterprise-ready
+ Hands-off (0 DevOps)

BEST FOR: Müşteri sunmaya hazır, production-grade
```

**Seçenek B: Railway (Ucuz, Hands-off)**
```
Railway: €5/mo (free tier credit)
TOTAL: €60/year

+ Hands-off (git push)
+ PostgreSQL included
+ Same tech as Render (Railway founders from Railway)
- No PITR/backups (manual needed)
- Smaller platform (less stable)

BEST FOR: MVP, tight budget, willing to add backup script
```

**Seçenek C: Fly.io (Balance)**
```
Fly.io: €0 (free tier) + €7/mo backup
TOTAL: €84/year

+ Eternal free tier
+ Global edge deployment (faster)
+ Docker-native (HuurGo compatible)
- Smaller platform (Render'dan daha risky)
- Backups manual until €7/mo

BEST FOR: Growth-minded, global customers, budget conscious
```

**Seçenek D: Oracle Cloud (Aggressive Savings)**
```
Oracle: €0 forever
TOTAL: €0/year

+ Eternal free (no scaling costs!)
+ 24GB RAM (luxury!)
+ Database + backups auto
- ARM64 (Dockerfile test 2-3h)
- Complex UI (4-6h setup)
- Not as "customer-ready"

BEST FOR: Long-term project, technical team, aggressive cost cut
```

---

## 📋 NEDEN BEN SEÇERDIM (Müşteri Modeli)

### **Senaryo: "Müşteriye free şurlada başla, sonra ödemeye geç"**

```
BEST OPTION: Render Standard

Neden?
1. "Free tier spindown yok" = müşteri rahatsız olmaz
2. "Backups auto" = müşteri verisi güvende
3. "PITR" = accident'de restore (customer trust!)
4. "Zero-downtime scaling" = müşteri fark etmez
5. "Enterprise feel" = €38/mo katla değer veriyor

Model:
  - Year 1: Kendi cebinden €456 öde (MVP)
  - Year 1+: Müşteriye €25/ay sun (Render cost cover + 40% margin)
  - Müşteri happy, sen profitable

Alternative (Budget):
  - Railway (€5/mo free tier) + backup script
  - Müşteriye €15/ay sun
  - Risky ama işe yarar
```

---

## ✅ TAVSIYE: İŞTE YAPACAKLARIN

### **Week 1: Upgrade Render (Safe Path)**

```bash
1. Render dashboard: Free → Standard upgrade (€23/mo)
2. PostgreSQL: Upgrade to Standard (€15/mo)
3. git push origin main (auto deploy)
4. Test everything (2 saat)
5. Domain: Add custom domain
6. = PRODUCTION READY (€38/mo)

Time: 1 saat setup
Risk: Minimal (already deployed)
Cost: €456/year
Hands-off: 100% (git push → done)
```

### **Week 2: PostgreSQL Backup Strategy**

```bash
# Çünkü Render has PITR, but belt+suspenders:
1. Enable Render "Database Snapshots" (auto daily)
2. Add: "Export backup to S3" (optional €10/mo, insurance)
3. Test: restore from snapshot (manual)
4. Document: restore procedure (5 min)

= Müşteri verisi triple-safe ✅
```

### **Week 3: Müşteri Modeli Hazırlığı**

```bash
1. Separate Render project oluştur (clone HuurGo)
2. Name: "huurgo-customer-template"
3. Dockerfile + docker-compose ready
4. README: "Deploy in 30 minutes"
5. Template: env vars checklist

= Any customer can deploy their own HuurGo instance in 1 hour
```

---

## 🎓 SONUÇ

### **Eğer şu 3'den birini seçersen:**

| Senin Hedef | Platform | Sebep |
|-------------|----------|-------|
| "Production now" | **Render** | €456/yr, trusted, zero DevOps |
| "Budget tight" | **Railway** | €60/yr, + 3h backup script |
| "Müşteri sunacağım" | **Render** | Customer trust > cost savings |
| "Long-term growth" | **Fly.io** | €0 free tier, backup €7/mo |
| "Aggressive cost-cut" | **Oracle** | €0 forever, setup 4h |

**BENİM TAVSIYEM:** Render Standard (€38/mo)
- ✅ Mevcut zaten orada
- ✅ 30 dakika upgrade
- ✅ Production-grade
- ✅ Müşteriye sunabilirsin
- ✅ Hands-off 100%

**Alternatif:** Railway (€5-20/mo) + backup script (3h)
- ✅ €300/year tasarruf
- ❌ Manual backup discipline gerekli

---

## 📞 Sorular?

- "PostgreSQL neden dahil değil?" → Compute + Storage separate pricing
- "Hangi platform müşteri-ready?" → Render, DigitalOcean, Fly.io (not Hetzner)
- "Şu an upgrade etmeli miyim?" → **YES, Render Standard'e. Hafta sonu, 30 dakika.**
- "Backup ne olacak?" → Render otomatik yapıyor (PITR + daily snapshots)

**Next step:** Render dashboarda git, "Upgrade to Standard" tıkla. Hepsi bu! 🚀
