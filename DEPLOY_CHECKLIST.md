# Render Deployment Checklist (Production Ready)

**Tarih:** 19 Haziran 2026  
**Müşteri:** [Müşteri Adı]  
**Domain:** [müşteri-domain.nl]  
**Render URL:** [müşteri-app.onrender.com]

---

## ✅ ADIM 1: RENDER SETUP (30 dakika)

### 1.1 App Instance
- [ ] Render.com'da login
- [ ] Create Service → Web Service
- [ ] Select: GitHub (devonurefe/transporting)
- [ ] Select: Branch `main`
- [ ] Select: Environment `Node`
- [ ] Instance Type: **Standard** (€23/mo)
- [ ] Region: **Frankfurt** (EU, fastest for Dutch market)
- [ ] Build Command: `npm run build`
- [ ] Start Command: `npm start`
- [ ] Set environment variables (see 1.3)

### 1.2 Database Instance
- [ ] Create Database → PostgreSQL
- [ ] Instance Type: **Basic-1GB** (€17/mo)
- [ ] Region: **Frankfurt** (same as app)
- [ ] Note: Backups auto-enabled ✅

### 1.3 Environment Variables (SET IN RENDER)

```
# ✅ MUST SET
DATABASE_URL=               # Auto-linked from PostgreSQL instance
JWT_SECRET=                 # Generate random 32-char: openssl rand -hex 16
RESEND_API_KEY=            # From resend.com (free tier ok)
EMAIL_FROM=                # noreply@[müşteri-domain.nl]
ADMIN_EMAIL=               # [müşteri-admin@müşteri-domain.nl]
VITE_WHATSAPP_NUMBER=      # From WhatsApp Business (customer's)
APP_URL=                   # https://[müşteri-domain.nl]
NODE_ENV=                  # production

# ✅ OPTIONAL
VITE_CLARITY_ID=           # Leave empty (no tracking)
REMINDER_SECRET=           # Generate random: openssl rand -hex 16
CALENDAR_FEED_TOKEN=       # Leave empty (unless needed)
```

---

## ✅ ADIM 2: CODE FIXES (10 dakika)

### 2.1 CORS Fix (CRITICAL!)

**File:** `server.ts` (line 49-51)

**CURRENT (WRONG):**
```typescript
const corsOptions = process.env.NODE_ENV === "production"
  ? { origin: ["https://huurgo.nl", "https://www.huurgo.nl"], credentials: true }
  : { origin: true, credentials: true };
```

**MUST CHANGE TO:**
```typescript
const corsOptions = process.env.NODE_ENV === "production"
  ? { 
      origin: [
        process.env.APP_URL || "https://localhost:3000",
        `https://${process.env.APP_URL?.replace("https://", "")}`,
        `https://www.${process.env.APP_URL?.replace("https://", "")}`
      ], 
      credentials: true 
    }
  : { origin: true, credentials: true };
```

**OR (SIMPLER):**
```typescript
const corsOptions = process.env.NODE_ENV === "production"
  ? { 
      origin: process.env.APP_URL || "https://localhost:3000",
      credentials: true 
    }
  : { origin: true, credentials: true };
```

**Action:**
- [ ] Update server.ts with new CORS config
- [ ] Test locally: `npm run dev` on custom domain
- [ ] git commit + push to main
- [ ] Render auto-redeploys

### 2.2 Email Configuration Check

**File:** `server/services/emailService.ts`

**Verify:**
- [ ] Resend API key is set (Render env var)
- [ ] EMAIL_FROM is set correctly
- [ ] Reply-to headers correct
- [ ] No hardcoded "huurgo" domain

**Test:**
```bash
# After deploy, test order confirmation email:
# 1. Admin: Create test order
# 2. Check: Email arrives at customer
# 3. Verify: Logo, links, sender name correct
```

### 2.3 WhatsApp Configuration

**File:** `src/utils/whatsapp.ts`

**Verify:**
- [ ] VITE_WHATSAPP_NUMBER is set (customer's WhatsApp Business number)
- [ ] Format: NO "+" (e.g., "31611848899")
- [ ] Test: Click WhatsApp button on booking form

---

## ✅ ADIM 3: DOMAIN SETUP (1 saat)

### 3.1 Müşteri Domain Seçimi

**Options:**
1. **Existing domain:** müşteri zaten domain'e sahip
2. **New domain:** yeni alan satın alınması gerek

**Action:**
- [ ] Müşteriye sor: "Hangi domain istiyorsun?"
- [ ] Domain provider'ı belirle (GoDaddy, Namecheap, etc.)

### 3.2 Domain Setup (If New)

```
GoDaddy / Namecheap:
  1. Search domain: [müşteri-domain.nl]
  2. Buy 1 year (budget ~€10-15)
  3. Add to cart + checkout
  4. Save credentials
  5. → Move to Render setup (3.3)
```

### 3.3 Add Domain to Render

**In Render Dashboard → Service Settings → Environment:**

1. **Custom Domains:**
   - [ ] Add Domain: `[müşteri-domain.nl]`
   - [ ] Render shows: "CNAME record needed"
   - [ ] Copy: `[generated-cname].onrender.com`

2. **In Domain Provider (GoDaddy/Namecheap):**
   - [ ] Go to DNS settings
   - [ ] Add CNAME record:
     ```
     Type: CNAME
     Name: @ (or leave blank)
     Value: [generated-cname].onrender.com
     TTL: 3600
     ```
   - [ ] Add www CNAME:
     ```
     Type: CNAME
     Name: www
     Value: [generated-cname].onrender.com
     TTL: 3600
     ```

3. **Wait for DNS Propagation:**
   - [ ] 5-10 minutes (usually instant)
   - [ ] Test: `nslookup [müşteri-domain.nl]`
   - [ ] Should resolve to Render IP

4. **Render Auto-SSL:**
   - [ ] SSL certificate auto-generated (Let's Encrypt)
   - [ ] HTTPS enabled automatically
   - [ ] Auto-renewal every 3 months

**Verification:**
- [ ] https://[müşteri-domain.nl] loads ✅
- [ ] No SSL warning ✅
- [ ] Redirect http → https works ✅

---

## ✅ ADIM 4: EMAIL SETUP (30-45 dakika)

### 4.1 Email Provider Decision

**Render Email Support:** ❌ NOT included

**Options:**

#### **Option A: Resend (Recommended ✅)**
```
Cost: €0 free tier (send 100 emails/day)
At scale: €20-100/mo

Setup:
  1. resend.com signup
  2. Verify domain (DNS DKIM record)
  3. Get API key
  4. Set RESEND_API_KEY in Render
  5. Already integrated in code ✅

Mails sent:
  - Order confirmation
  - Status updates
  - Password reset
  - Daily reminders
```

#### **Option B: Mailgun (Alternative)**
```
Cost: €0 free tier (up to 30 days, then paid)
Setup: More complex (DKIM, SPF, DMARC)
Integration: Change emailService.ts (hours of work)

NOT RECOMMENDED for now
```

#### **Option C: Gmail SMTP (Not Secure)**
```
NOT RECOMMENDED (not reliable for business)
```

### 4.2 Resend Setup

**Step 1: Create Account**
```
1. Go: resend.com
2. Signup (free)
3. Verify email
```

**Step 2: Verify Domain**
```
1. Resend Dashboard → Domains
2. Add Domain: [müşteri-domain.nl]
3. Resend shows DNS records (DKIM, SPF, DMARC)
4. Go to domain provider (GoDaddy, Namecheap)
5. Add DNS records:
   - TXT SPF record
   - CNAME DKIM records (3×)
   - DMARC policy
6. Wait 5-10 min for DNS propagation
7. Resend auto-verifies ✅
```

**Step 3: Get API Key**
```
1. Resend → API Keys
2. Copy: RESEND_API_KEY (starts with "re_...")
3. Paste into Render environment variables
```

**Step 4: Configure EMAIL_FROM**
```
In Render environment:
  EMAIL_FROM=noreply@[müşteri-domain.nl]
  
Resend automatically sends from this address
(no special SMTP config needed - code already handles it!)
```

**Step 5: Test Email**
```
After deploy:
  1. Create order in HuurGo
  2. Check: Confirmation email arrives
  3. Verify: From address is noreply@[domain]
  4. Verify: Links work, formatting correct
```

### 4.3 Email Monitoring

**In Resend Dashboard:**
- [ ] Monitor email delivery
- [ ] Check bounce/spam rates
- [ ] Verify no authentication failures

---

## ✅ ADIM 5: DATABASE BACKUP & RESTORE (15 dakika)

### 5.1 Automatic Backups
- [ ] Render → Database → Backups tab
- [ ] Verify: "Daily snapshots" ✅
- [ ] Retention: 7 days (auto)

### 5.2 Test Restore (CRITICAL!)
```
1. Render → Database → Backups
2. Select: Latest snapshot
3. Click: "Restore to new database"
4. Verify: Data intact
5. Delete: Test database
6. Document: Restore procedure
```

**Restore Procedure (For Reference):**
1. Go to Render dashboard
2. Select database → Backups
3. Choose snapshot date
4. Click "Restore"
5. Wait 5-10 minutes
6. Data restored ✅

---

## ✅ ADIM 6: TESTING (30 dakika)

### 6.1 Functional Tests
- [ ] Homepage loads: https://[müşteri-domain.nl]
- [ ] Catalog shows machines: API working
- [ ] Login works: Admin credentials
- [ ] Booking flow works: All 3 steps
- [ ] Invoice preview works
- [ ] WhatsApp button works (test message)
- [ ] No console errors (F12)

### 6.2 Performance Tests
- [ ] Page load time < 2 seconds
- [ ] Database query < 100ms
- [ ] API response < 500ms

### 6.3 Security Tests
- [ ] SSL certificate valid (no warnings)
- [ ] HTTPS forced (no http access)
- [ ] Login hashes passwords ✅
- [ ] No sensitive data in logs

### 6.4 Email Tests
- [ ] Send test order → verify email
- [ ] Check spam folder (shouldn't be there)
- [ ] Verify sender name correct
- [ ] Verify links work

---

## ✅ ADIM 7: MONITORING SETUP (15 dakika)

### 7.1 Uptime Monitoring (FREE)
```
1. Go: uptimerobot.com (free account)
2. Create Monitor:
   - URL: https://[müşteri-domain.nl]
   - Interval: 5 minutes
   - Alert: Email
3. Notification: To ADMIN_EMAIL
4. Done ✅
```

### 7.2 Render Metrics (Built-in)
- [ ] CPU: Check dashboard (target < 20% avg)
- [ ] Memory: Check dashboard (target < 1 GB)
- [ ] Database: Check storage (target < 20% of 10GB)
- [ ] Set weekly check reminder

### 7.3 Error Monitoring (OPTIONAL)
- Sentry: €29/mo (skip for now, add later if issues)
- Manual: Check Render logs weekly

---

## ✅ ADIM 8: FINAL CHECKLIST

### Before Going Live:
- [ ] Database upgraded (Free → Basic-1GB)
- [ ] App upgraded (Free → Standard)
- [ ] CORS fixed (hardcoded domain removed)
- [ ] Domain CNAME configured
- [ ] SSL certificate active
- [ ] Resend domain verified
- [ ] RESEND_API_KEY set in Render
- [ ] All env vars set (DATABASE_URL, JWT_SECRET, etc.)
- [ ] Test order sends email ✅
- [ ] Test booking workflow ✅
- [ ] Admin login works ✅
- [ ] Uptime monitoring running ✅

### LAUNCH CHECKLIST:
- [ ] Inform customer: System live at https://[domain]
- [ ] Give admin login credentials (separately, secure)
- [ ] Provide: Support email + WhatsApp
- [ ] Provide: Password reset procedure
- [ ] Provide: Backup/restore documentation
- [ ] Schedule: 1-week follow-up call

---

## 📋 ENVIRONMENT VARIABLES (Template)

```
# .env file (never commit!)
# Set in Render Dashboard → Service → Environment Variables

# Database (auto-linked from Render PostgreSQL)
DATABASE_URL=postgresql://user:pass@...?connection_limit=10&pool_timeout=20

# Authentication
JWT_SECRET=random-32-char-secret-here

# Email (Resend)
RESEND_API_KEY=re_xxx_xxx_xxx
EMAIL_FROM=noreply@[müşteri-domain.nl]
ADMIN_EMAIL=admin@[müşteri-domain.nl]

# WhatsApp
VITE_WHATSAPP_NUMBER=31611848899

# App
APP_URL=https://[müşteri-domain.nl]
NODE_ENV=production

# Optional
VITE_CLARITY_ID=  # Leave empty
REMINDER_SECRET=random-32-char-secret-here
CALENDAR_FEED_TOKEN=  # Leave empty
```

---

## 🆘 TROUBLESHOOTING

### "Domain DNS not propagating"
- [ ] Wait 10-15 minutes
- [ ] Clear browser DNS cache: `ipconfig /flushdns` (Windows) or `sudo dscacheutil -flushcache` (Mac)
- [ ] Test: `nslookup [domain]`

### "SSL certificate warning"
- [ ] Wait 10 minutes for Let's Encrypt cert
- [ ] Refresh browser (Ctrl+Shift+R hard refresh)
- [ ] If persists: Check Render logs

### "Email not arriving"
- [ ] Check Render logs for errors
- [ ] Verify: RESEND_API_KEY is set
- [ ] Verify: EMAIL_FROM is correct
- [ ] Check: Spam folder
- [ ] Verify: Domain DKIM records in Resend

### "CORS error in browser console"
- [ ] Fix: server.ts CORS (see 2.1)
- [ ] Redeploy: git push to main
- [ ] Wait 2-3 min for Render rebuild

### "502 Bad Gateway"
- [ ] Check: Database connected
- [ ] Check: Render logs for errors
- [ ] Restart: Service (Render dashboard)
- [ ] If persistent: Database may be down

---

## 📞 CUSTOMER SUPPORT

**When live, provide:**
```
Support Email: support@[senin-domain.nl]
WhatsApp: [Your WhatsApp]
Emergency: [Your Phone]

SLA:
  - Response time: 24 hours (email)
  - Uptime: 99.9% (monitored)
  - Backups: Daily (automatic)
  - Data deletion: 30 days after termination
```

---

## ✅ SIGN-OFF

- [ ] All items checked ✅
- [ ] Customer informed ✅
- [ ] Go-live date: ___________
- [ ] Support plan in place ✅

**Ready for production!** 🚀

---

**Last Updated:** 19 Haziran 2026  
**Next Review:** 30 days post-launch
