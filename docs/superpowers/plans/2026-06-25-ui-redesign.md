# DLHub Full UI Redesign Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** DLHub'un tüm frontend'ini UX odaklı olarak sıfırdan yeniden tasarla; tipografi, renk sistemi, bileşen tasarımları ve i18n düzeltmeleri dahil. Frontend tamamlanınca backend audit et.

**Architecture:** Mevcut Next.js/Tailwind v4/shadcn altyapısı korunur; yalnızca `globals.css`, font yükleme, ve bileşen TSX dosyaları değiştirilir. shadcn `base-nova` stil korunur, design token'ları override edilir.

**Tech Stack:** Next.js 16 · TypeScript · Tailwind v4 · shadcn/ui (base-nova) · next-intl (TR/EN) · Lucide icons · next/font (Google Fonts veya local)

## Global Constraints

- Tüm UI metinleri `tr.json` ve `en.json` üzerinden `useTranslations` ile alınır — hardcode metin kesinlikle yasak
- `oklch()` renk formatı korunur (Tailwind v4 ile uyumlu)
- shadcn CSS variable isimleri korunur (`--primary`, `--card`, vb.) — component'lar bunlara bağımlı
- Dark/light mod desteği korunur
- Responsive tasarım: mobile-first, max-w-2xl içerik genişliği
- Commit mesajları İngilizce

---

## Research Summary

### Mevcut Durum Tespiti

**Font:** Geist Sans tek font — `--font-sans`, `--font-mono`, `--font-condensed`, `--font-heading` hepsi aynı `var(--font-geist-sans)` değerine işaret ediyor. Hiçbir tipografik hiyerarşi yok.

**Renkler:** Tamamen akromatik (chroma=0). Dark mode'da yalnızca çok hafif mavi tint (chroma=0.008, hue=240). `--primary` rengi light'ta near-black, dark'ta near-white. Marka rengi yok.

**Bileşenler:**
- **Navbar:** Sticky, blur backdrop, `Download` ikonu + "DLHub" text. UserMenu: avatar dropdown (Base UI), tema/dil seçimi içinde.
- **DownloadForm:** 5 faz (idle, fetching, ready, downloading, completed+cancelled+error). İyi yapılandırılmış ama görsel çekiciliği az.
- **DownloadHistory:** Arama + status filtre pill'leri + liste. Tarih gruplaması yok.
- **SupportedSites:** Collapsible, arama destekli etiket listesi.
- **Login:** Centered card, Google OAuth + magic link.
- **NotificationBell:** Admin-only, tüm string'ler hardcode Türkçe.

### i18n Hardcode Sorunları

| Dosya | Hardcode string | Önerilen key |
|---|---|---|
| `DownloadForm.tsx` | `"${phase.eta} kaldı"` | `download.etaLeft` |
| `DownloadForm.tsx` | `"İndirme sırasında hata oluştu"` | `download.errors.failed` |
| `DownloadForm.tsx` | `"Sunucu bağlantısı kesildi"` | `download.errors.serverDisconnected` |
| `DownloadForm.tsx` | `"Günlük indirme limitine ulaştınız"` | `download.errors.dailyLimit` |
| `DownloadForm.tsx` | `"Bu domain indirme için izin verilmiyor"` | `download.errors.domainBlocked` |
| `DownloadForm.tsx` | `"İndirme başlatılamadı"` | `download.errors.startFailed` |
| `DownloadForm.tsx` | `"Sunucuya bağlanılamadı"` | `download.errors.connectionFailed` |
| `DownloadForm.tsx` | `"Format bilgisi alınamadı"` | `download.errors.formatFailed` |
| `DownloadHistory.tsx` | `fmtDateTime` → `"Bugün, ..."` `"Dün, ..."` | `history.today` `history.yesterday` |
| `NotificationBell.tsx` | `"Bildirimler"`, `"Tümünü okundu işaretle"`, `"Bildirim yok"` | `admin.notifications.*` |
| `NotificationBell.tsx` | `"az önce"`, `"dk"`, `"s"`, `"g"` suffixes | `admin.timeAgo.*` |

### Backend Audit Listesi (Task 9)

- [ ] `POST /api/downloads` — ikinci aktif indirme başlatmayı engelliyor mu? (DB'de `status='downloading'` kontrolü)
- [ ] `GET /api/formats` — rate limiting var mı?
- [ ] Cron job (`src/lib/cron.ts` veya benzeri) — `cancelled` status'ü cleanup'a dahil mi? `expired` ve `error` için ne yapıyor?
- [ ] Partial dosya cleanup: `id_` prefix scan yeterli mi, `.part` uzantılı dosyalar da kapsamına giriyor mu?
- [ ] Download token: `createDownloadToken` — expiry kontrol zinciri güvenli mi?

---

## Task Listesi

### Task 1: Tipografi Sistemi

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`

**Hedef:** Tek-font Geist sistemini 3-font hiyerarşiye yükselt.

- `--font-heading` → **Manrope** (bold başlıklar, logo, section title'lar)
- `--font-sans` → **Inter** (body, UI metinleri, butonlar)
- `--font-mono` → **IBM Plex Mono** (dosya boyutu, hız, codec isimleri, teknik veriler)

- [ ] **Step 1: Font'ları Google Fonts'tan yükle**

`src/app/layout.tsx` içinde `next/font/google` ile 3 font import et:
```typescript
import { Manrope, Inter, IBM_Plex_Mono } from "next/font/google";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});
```

Body tag'ına `className` ekle: `${manrope.variable} ${inter.variable} ${ibmPlexMono.variable}`

Mevcut `geist` import'unu kaldır.

- [ ] **Step 2: CSS variables'ı güncelle**

`globals.css` içinde `@theme inline` bloğunu güncelle:
```css
--font-heading: var(--font-manrope);
--font-sans: var(--font-inter);
--font-mono: var(--font-ibm-plex-mono);
--font-condensed: var(--font-inter);
```

- [ ] **Step 3: Heading utility class'ı ekle**

`globals.css` `@layer base` içine:
```css
h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-heading);
}
```

- [ ] **Step 4: Görsel test**

`pnpm dev` ile geliştirme sunucusunu başlat, her sayfada font'ların doğru yüklendiğini kontrol et.

- [ ] **Step 5: Commit**
```bash
git add src/app/layout.tsx src/app/globals.css
git commit -m "feat: add 3-font typography system (Manrope + Inter + IBM Plex Mono)"
```

---

### Task 2: Renk Sistemi ve Design Token'lar

**Files:**
- Modify: `src/app/globals.css`

**Hedef:** Tamamen akromatik sistemi brand accent rengiyle güçlendir; border radius'u ayarla; subtle color refinements.

**Renk kararı:** Mevcut akromatik sistem korunur. `--primary` mevcut haliyle kalır (dark'ta near-white, light'ta near-black). Tek eklenti: "indigo/blue accent" rengi sadece `--ring` ve focus state'ler için — butonlar, seçilmiş state'ler ve progress bar için. Bu akromatik palet üzerinde hafif bir marka kimliği oluşturur.

- [ ] **Step 1: Dark mode token'larını iyileştir**

`globals.css` `.dark` bloğunda:
```css
/* Daha temiz background — hafif blue tint artırılmış */
--background: oklch(0.14 0.01 240);
/* Card biraz daha belirgin */
--card: oklch(0.19 0.009 240);
/* Popover */
--popover: oklch(0.19 0.009 240);
/* Border biraz daha görünür */
--border: oklch(1 0 0 / 12%);
/* Input */
--input: oklch(1 0 0 / 18%);
/* Muted biraz daha koyu */
--muted: oklch(0.25 0.007 240);
/* Ring: indigo accent — focus/seçili state'ler için */
--ring: oklch(0.65 0.18 264);
/* Primary: indigo-tinted white yerine saf near-white */
--primary: oklch(0.93 0 0);
```

- [ ] **Step 2: Light mode token'larını iyileştir**

`globals.css` `:root` bloğunda:
```css
/* Ring: indigo — focus highlight */
--ring: oklch(0.55 0.22 264);
/* Border: hafif daha belirgin */
--border: oklch(0.9 0 0);
```

- [ ] **Step 3: Border radius küçük ayar**

Mevcut `--radius: 0.625rem` → `--radius: 0.5rem` (biraz daha kompakt, modern)

- [ ] **Step 4: Görsel test — dark ve light modda her sayfayı kontrol et**

- [ ] **Step 5: Commit**
```bash
git add src/app/globals.css
git commit -m "feat: refine color tokens — indigo ring accent, darker dark mode bg"
```

---

### Task 3: Navbar Yeniden Tasarımı

**Files:**
- Modify: `src/components/layout/Navbar.tsx`

**Hedef:** Logoyu güçlendir; Navbar'a daha belirgin görsel ağırlık ver.

- [ ] **Step 1: Logo'yu güncelle**

Mevcut: `<Download className="size-4" /> DLHub`

Yeni: Logo için Manrope bold kullan, ikon + metin kombinasyonunu iyileştir:
```tsx
<Link href="/" className="flex items-center gap-2 select-none group">
  <div className="flex size-7 items-center justify-center rounded-lg bg-foreground text-background transition-transform group-hover:scale-105">
    <Download className="size-3.5" />
  </div>
  <span className="font-heading font-extrabold text-base tracking-tight">DLHub</span>
</Link>
```

- [ ] **Step 2: Header height ve border düzelt**

Mevcut `h-14` korunur. Border'ı `border-b border-border/60` yap (hafif daha subtle).

Backdrop blur iyileştir:
```tsx
<header className="sticky top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
```

- [ ] **Step 3: Commit**
```bash
git add src/components/layout/Navbar.tsx
git commit -m "feat: redesign navbar logo with filled icon container"
```

---

### Task 4: Login Sayfası Yeniden Tasarımı

**Files:**
- Modify: `src/app/(auth)/login/page.tsx`
- Modify: `src/app/(auth)/login/MagicLinkForm.tsx`

**Hedef:** Login sayfasına marka kimliği ekle; form UX'ini iyileştir.

- [ ] **Step 1: Logo bloğunu güçlendir**

Mevcut: `<h1 className="text-4xl font-black tracking-tight">{t("title")}</h1>`

Yeni:
```tsx
<div className="flex flex-col items-center gap-4">
  <div className="flex size-14 items-center justify-center rounded-2xl bg-foreground text-background">
    <Download className="size-7" />
  </div>
  <div className="text-center space-y-1">
    <h1 className="font-heading text-3xl font-extrabold tracking-tight">{t("title")}</h1>
    <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
  </div>
</div>
```

- [ ] **Step 2: Google butonu iyileştir**

Mevcut outline butona küçük tweakler — `gap-2.5`, daha belirgin hover:
```tsx
<Button type="submit" className="w-full h-11" variant="outline">
  {/* SVG aynı */}
  {t("googleSignIn")}
</Button>
```

- [ ] **Step 3: Magic link input ve buton**

MagicLinkForm'da input `h-11` yap (Google butonuyla hizala), `Button` da `h-11`.

- [ ] **Step 4: Commit**
```bash
git add src/app/(auth)/login/page.tsx src/app/(auth)/login/MagicLinkForm.tsx
git commit -m "feat: redesign login page with branded logo block"
```

---

### Task 5: DownloadForm Yeniden Tasarımı

**Files:**
- Modify: `src/components/download/DownloadForm.tsx`

**Hedef:** Her faz için görsel kaliteyi artır; URL input için daha davetkar tasarım; format grid'i iyileştir; progress gösterimini zenginleştir.

- [ ] **Step 1: Idle faz — URL input bloğunu güçlendir**

Mevcut: sade `Input` + `Button` yan yana.

Yeni: URL input'unu daha büyük yap (`h-12`), fetch butonunu birincil call-to-action olarak vurgula:
```tsx
<div className="flex gap-2">
  <Input
    placeholder="youtube.com, instagram.com, …"
    value={url}
    onChange={...}
    onKeyDown={...}
    className="h-12 text-sm flex-1"
  />
  <Button onClick={handleFetchFormats} disabled={!url.trim() || isFetching} className="h-12 px-5">
    {t("fetch")}
  </Button>
</div>
```

- [ ] **Step 2: Fetching faz — loading görünümünü iyileştir**

Mevcut: basit `Loader2 + text`.

Yeni: subtle pulse animation ile URL preview:
```tsx
{phase.type === "fetching" && (
  <div className="flex items-center gap-3 py-2 text-muted-foreground">
    <Loader2 className="size-4 animate-spin shrink-0" />
    <div className="flex-1 min-w-0">
      <span className="text-sm">{t("loading")}</span>
      <p className="text-xs text-muted-foreground/60 truncate mt-0.5">{url}</p>
    </div>
  </div>
)}
```

- [ ] **Step 3: Ready faz — thumbnail ve başlık bloğunu iyileştir**

Thumbnail aspect-ratio korunur. Başlık Manrope font ile:
```tsx
<p className="font-heading text-sm font-semibold leading-snug line-clamp-2">{phase.info.title}</p>
```

- [ ] **Step 4: Ready faz — format grid'i iyileştir**

Mevcut 2/3 col grid korunur. Seçili state daha belirgin olsun:
- Seçilmemiş: `border-border bg-background hover:border-primary/30 hover:bg-primary/5`
- Seçili: `border-primary bg-primary text-primary-foreground shadow-sm`

Codec tag'ları daha okunaklı:
- Seçilmemiş: `bg-muted/80 text-muted-foreground`
- Seçili: `bg-background/20 text-primary-foreground`

- [ ] **Step 5: Downloading faz — progress bloğunu zenginleştir**

Title için Manrope:
```tsx
<p className="font-heading text-sm font-semibold truncate">{phase.title}</p>
```

Progress bar rengi: indigo accent kullan (ring renginden gelir):
```tsx
<div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
  <div
    className="h-full bg-ring rounded-full transition-[width] duration-500"
    style={{ width: `${Math.max(2, phase.percent)}%` }}
  />
</div>
```

Hız ve ETA mono font ile:
```tsx
<span className="font-mono text-xs">{phase.speed}</span>
```

- [ ] **Step 6: Completed faz — download butonunu büyüt**

CheckCircle yerine daha belirgin tamamlanma göstergesi:
```tsx
<div className="rounded-lg border border-border/60 bg-card p-4 flex items-center gap-3">
  <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 shrink-0">
    <CheckCircle className="size-5 text-primary" />
  </div>
  <div className="min-w-0 flex-1">
    <p className="font-heading text-sm font-semibold truncate">{phase.title ?? t("download")}</p>
    <p className="text-xs text-muted-foreground">{t("validFor24h")}</p>
  </div>
</div>
```

- [ ] **Step 7: Commit**
```bash
git add src/components/download/DownloadForm.tsx
git commit -m "feat: redesign DownloadForm phases for improved visual hierarchy"
```

---

### Task 6: i18n Hardcode Düzeltmeleri

**Files:**
- Modify: `messages/tr.json`
- Modify: `messages/en.json`
- Modify: `src/components/download/DownloadForm.tsx`
- Modify: `src/components/download/DownloadHistory.tsx`
- Modify: `src/components/admin/NotificationBell.tsx`

**Hedef:** Tüm hardcode Türkçe metinleri i18n key'lerine taşı.

- [ ] **Step 1: `messages/tr.json` — yeni key'ler ekle**

`"download"` bloğuna:
```json
"etaLeft": "{eta} kaldı",
"errors": {
  "failed": "İndirme sırasında hata oluştu",
  "serverDisconnected": "Sunucu bağlantısı kesildi",
  "dailyLimit": "Günlük indirme limitine ulaştınız",
  "domainBlocked": "Bu domain indirme için izin verilmiyor",
  "startFailed": "İndirme başlatılamadı",
  "connectionFailed": "Sunucuya bağlanılamadı",
  "formatFailed": "Format bilgisi alınamadı"
}
```

`"history"` bloğuna:
```json
"today": "Bugün",
"yesterday": "Dün"
```

`"admin"` bloğuna:
```json
"notificationsTitle": "Bildirimler",
"markAllRead": "Tümünü okundu işaretle",
"noNotifications": "Bildirim yok",
"timeJustNow": "az önce",
"timeMin": "{count}dk",
"timeHour": "{count}s",
"timeDay": "{count}g"
```

- [ ] **Step 2: `messages/en.json` — aynı key'leri İngilizce ekle**

`"download"` bloğuna:
```json
"etaLeft": "{eta} left",
"errors": {
  "failed": "Download failed",
  "serverDisconnected": "Server connection lost",
  "dailyLimit": "Daily download limit reached",
  "domainBlocked": "This domain is not allowed for downloads",
  "startFailed": "Failed to start download",
  "connectionFailed": "Could not connect to server",
  "formatFailed": "Could not fetch format info"
}
```

`"history"` bloğuna:
```json
"today": "Today",
"yesterday": "Yesterday"
```

`"admin"` bloğuna:
```json
"notificationsTitle": "Notifications",
"markAllRead": "Mark all as read",
"noNotifications": "No notifications",
"timeJustNow": "just now",
"timeMin": "{count}m",
"timeHour": "{count}h",
"timeDay": "{count}d"
```

- [ ] **Step 3: DownloadForm.tsx hardcode'ları düzelt**

`phase.eta` satırını: `phase.eta ? t("etaLeft", { eta: phase.eta }) : null`

Her hardcode hata mesajını ilgili `t("errors.X")` key'iyle değiştir.

- [ ] **Step 4: DownloadHistory.tsx — fmtDateTime i18n'e taşı**

`fmtDateTime` fonksiyonunu `useTranslations("history")` t fonksiyonunu parametre olarak alacak şekilde refactor et:
```typescript
function fmtDateTime(dateStr: string, t: ReturnType<typeof useTranslations<"history">>): string {
  ...
  if (isToday) return `${t("today")}, ${time}`;
  if (isYesterday) return `${t("yesterday")}, ${time}`;
  ...
}
```

Çağrı: `fmtDateTime(dl.createdAt, t)`

- [ ] **Step 5: NotificationBell.tsx hardcode'ları düzelt**

`useTranslations("admin")` import et, tüm hardcode string'leri key'lerle değiştir.
`timeAgo` fonksiyonunu `t` parametresi alacak şekilde güncelle.

- [ ] **Step 6: Commit**
```bash
git add messages/tr.json messages/en.json src/components/download/DownloadForm.tsx src/components/download/DownloadHistory.tsx src/components/admin/NotificationBell.tsx
git commit -m "fix: move all hardcoded Turkish strings to i18n message files"
```

---

### Task 7: DownloadHistory Yeniden Tasarımı

**Files:**
- Modify: `src/components/download/DownloadHistory.tsx`

**Hedef:** Tarih gruplamasi ekle; list item'ları için daha zengin görsel.

- [ ] **Step 1: Tarih gruplama fonksiyonu ekle**

```typescript
function groupByDate(
  downloads: DownloadRecord[],
  t: ReturnType<typeof useTranslations<"history">>
): { label: string; items: DownloadRecord[] }[] {
  const groups: Map<string, DownloadRecord[]> = new Map();
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  for (const dl of downloads) {
    const date = new Date(dl.createdAt);
    let key: string;
    if (date.toDateString() === now.toDateString()) key = t("today");
    else if (date.toDateString() === yesterday.toDateString()) key = t("yesterday");
    else key = date.toLocaleDateString(undefined, { day: "numeric", month: "long", year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
    
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(dl);
  }

  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}
```

- [ ] **Step 2: List render'ını gruplu yapıya çevir**

Mevcut `<ul>` tek listesi → tarih başlıklı gruplar:
```tsx
{groupByDate(filtered, t).map(({ label, items }) => (
  <div key={label} className="space-y-1">
    <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-muted-foreground/60 px-1 pt-1">
      {label}
    </p>
    <ul className="space-y-1">
      {items.map((dl) => (
        /* mevcut <li> kodu */
      ))}
    </ul>
  </div>
))}
```

- [ ] **Step 3: List item görselini iyileştir**

Her `<li>` için: sol tarafta platform favicon (küçük, opsiyonel) veya file format badge; daha temiz metadata satırı.

File format badge'ini `font-mono` ile göster:
```tsx
<span className="font-mono text-[0.75rem] font-medium">{formatLabel(dl.format)}</span>
```

File size ve duration da mono:
```tsx
<span className="font-mono text-xs">{fileSize(dl.fileSize)}</span>
```

- [ ] **Step 4: Commit**
```bash
git add src/components/download/DownloadHistory.tsx
git commit -m "feat: add date grouping and mono font for technical data in DownloadHistory"
```

---

### Task 8: SupportedSites ve Küçük Bileşen Polishleri

**Files:**
- Modify: `src/components/download/SupportedSites.tsx`
- Modify: `src/components/layout/LanguageToggle.tsx`
- Modify: `src/components/layout/ThemeToggle.tsx`

**Hedef:** Kalan bileşenleri yeni tasarım diline uyumlu hale getir.

- [ ] **Step 1: SupportedSites tag'lerini iyileştir**

Mevcut `px-2.5 py-1 rounded-full bg-muted text-xs text-muted-foreground` →
```tsx
<span className="inline-flex items-center px-2.5 py-1 rounded-md bg-muted/70 text-xs text-muted-foreground border border-border/60 hover:border-border transition-colors">
  {s.name}
</span>
```

- [ ] **Step 2: LanguageToggle — font-mono ekle**

`TR/EN` text'lerini `font-mono text-[0.7rem]` yap — daha teknik hissettirsin.

- [ ] **Step 3: ThemeToggle — küçük polish**

Seçili state icon'u biraz daha belirgin yap: `bg-foreground/15` yerine `bg-primary/15`.

- [ ] **Step 4: Commit**
```bash
git add src/components/download/SupportedSites.tsx src/components/layout/LanguageToggle.tsx src/components/layout/ThemeToggle.tsx
git commit -m "feat: polish SupportedSites tags, LanguageToggle, ThemeToggle"
```

---

### Task 9: Backend Audit

**Files:** (audit only — fix'ler ayrı commit'ler olacak)
- Audit: `src/app/api/downloads/route.ts` (POST handler)
- Audit: `src/app/api/formats/route.ts`
- Audit: `src/lib/cron.ts` (varsa)
- Audit: tüm `/api/` dosyaları

**Hedef:** Açık güvenlik/işlevsellik sorunlarını tespit et ve düzelt.

- [ ] **Step 1: Aktif indirme limiti kontrolü**

`POST /api/downloads` handler'ında:
- Kullanıcının zaten aktif bir indirmesi varsa (`status IN ('downloading','pending')`) yeni indirme başlatmayı engelle
- Eğer kontrol yoksa ekle: `WHERE userId=? AND status IN ('downloading','pending')` → varsa 409 Conflict döndür

- [ ] **Step 2: Formats endpoint rate limiting**

`GET /api/formats` — yt-dlp'yi çağırıyor ve CPU/network yoğun. Rate limiting var mı?
- Yoksa: kullanıcı başına `next-rate-limit` veya basit in-memory map ile ekle (örn. 10 req/dakika)

- [ ] **Step 3: Cron job audit**

Cron job'ı bul. Kontrol et:
- `cancelled` ve `error` status'lü kayıtlar cleanup'a giriyor mu?
- Partial dosya temizliği yapılıyor mu (`id_` prefix scan)?
- `completed` ve süresi dolmuş kayıtlar için dosya silme + DB güncelleme çalışıyor mu?

Eksik varsa ekle.

- [ ] **Step 4: Download token güvenliği**

`createDownloadToken` ve `verifyDownloadToken` — JWT imzalama kullanılıyor mu?
Expiry check double-done mu (token expiry + DB expiresAt)?

- [ ] **Step 5: Commit (sadece gerçek fix'ler için)**
```bash
git commit -m "fix: enforce single active download per user in POST /api/downloads"
# + diğer fix'ler
```

---

### Task 10: Push ve Deploy

- [ ] **Step 1: Tüm değişiklikleri push et**
```bash
git push origin main
```

CI/CD otomatik deploy eder. GitHub Actions → SSH → git pull → docker compose build → up.

- [ ] **Step 2: Production kontrolü**

Her sayfada dark/light mod test et, font'ların doğru yüklendiğini kontrol et, download flow'u uçtan uca test et.
