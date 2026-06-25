# Download Cancel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kullanıcı aktif indirmeyi iptal edebilir; yt-dlp process'i durdurulur, sunucudaki tüm kalıntı dosyalar silinir, kayıt `cancelled` statüsüyle geçmişte görünür.

**Architecture:** Mevcut `DELETE /api/downloads/[id]` endpoint'i `cancelled` statüsü verecek şekilde güncellenir ve partial dosya temizliği eklenir. Frontend'de indirme aşamasına cancel butonu eklenir, yeni `cancelled` phase state'i ve geçmiş badge'i tanımlanır.

**Tech Stack:** Next.js 16 · TypeScript · DrizzleORM · Tailwind v4 · shadcn · next-intl

## Global Constraints

- Tüm UI metinleri `tr.json` ve `en.json` üzerinden `useTranslations` ile alınır — hardcode metin yasak
- shadcn `Button` bileşeni kullanılır, raw `<button>` sadece mevcut kodda zaten varsa
- `DOWNLOADS_PATH` env değişkeni; default `/downloads`
- Commit mesajları İngilizce

---

### Task 1: API — DELETE endpoint `cancelled` statüsü ve partial dosya temizliği

**Files:**
- Modify: `src/app/api/downloads/[id]/route.ts`

**Interfaces:**
- Produces: `DELETE /api/downloads/[id]` → `{ ok: true }` (200) veya hata

- [ ] **Step 1: `route.ts` DELETE handler'ı güncelle**

`src/app/api/downloads/[id]/route.ts` içindeki DELETE fonksiyonunu şu şekilde değiştir:

```typescript
import { readdir } from "fs/promises";
import path from "path";

const DOWNLOADS_PATH = process.env.DOWNLOADS_PATH ?? "/downloads";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const download = await db.query.downloads.findFirst({
    where: eq(downloads.id, id),
    columns: {
      id: true,
      userId: true,
      status: true,
      filePath: true,
    },
  });

  if (!download) return Response.json({ error: "Bulunamadı" }, { status: 404 });
  if (!await requireAccess(download.userId, session.user.id)) {
    return Response.json({ error: "Yetkisiz" }, { status: 403 });
  }

  const isActive = download.status === "downloading" || download.status === "pending";

  if (isActive) {
    // yt-dlp process'ini öldür ve store'dan temizle
    cancelDownload(id);

    // DOWNLOADS_PATH altında `{id}_` prefix'li tüm dosyaları sil (.part dahil)
    try {
      const files = await readdir(DOWNLOADS_PATH);
      await Promise.all(
        files
          .filter((f) => f.startsWith(`${id}_`))
          .map((f) =>
            unlink(path.join(DOWNLOADS_PATH, f)).catch(() => {/* zaten silinmiş olabilir */})
          )
      );
    } catch {
      // dizin okunamazsa devam et
    }

    await db
      .update(downloads)
      .set({ status: "cancelled", filePath: null })
      .where(eq(downloads.id, id));

    return Response.json({ ok: true });
  }

  // Aktif olmayan indirme — eski davranış (dosyayı sil, expired yap)
  if (download.filePath) {
    try {
      await unlink(download.filePath);
    } catch { /* zaten silinmiş */ }
  }

  await db
    .update(downloads)
    .set({ status: "expired", filePath: null })
    .where(eq(downloads.id, id));

  return Response.json({ ok: true });
}
```

- [ ] **Step 2: Manuel test**

SSH ile sunucuya gerek yok. Lokal `docker compose up` ile test edilebilir ya da aşağıdaki mantık kontrolü yapılır:
- Aktif download varken DELETE isteği → `cancelled` statüsü, dosyalar silinmiş
- Aktif olmayan download için DELETE → `expired` statüsü (mevcut davranış korunuyor)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/downloads/[id]/route.ts
git commit -m "feat: cancel active download — set cancelled status, clean partial files"
```

---

### Task 2: i18n — `cancelled` çevirileri

**Files:**
- Modify: `messages/tr.json`
- Modify: `messages/en.json`

**Interfaces:**
- Produces: `t("download.cancel")`, `t("download.cancelling")`, `t("download.cancelled")`, `t("history.filterCancelled")`, `t("history.cancelled")`, `t("admin.statusCancelled")`

- [ ] **Step 1: `messages/tr.json` güncellemesi**

`"download"` bloğuna ekle:
```json
"cancel": "İptal Et",
"cancelling": "İptal ediliyor…",
"cancelled": "İndirme iptal edildi"
```

`"history"` bloğuna ekle:
```json
"filterCancelled": "İptal Edildi",
"cancelled": "İptal edildi"
```

`"admin"` bloğuna ekle:
```json
"statusCancelled": "İptal Edildi"
```

- [ ] **Step 2: `messages/en.json` güncellemesi**

`"download"` bloğuna ekle:
```json
"cancel": "Cancel",
"cancelling": "Cancelling…",
"cancelled": "Download cancelled"
```

`"history"` bloğuna ekle:
```json
"filterCancelled": "Cancelled",
"cancelled": "Cancelled"
```

`"admin"` bloğuna ekle:
```json
"statusCancelled": "Cancelled"
```

- [ ] **Step 3: Commit**

```bash
git add messages/tr.json messages/en.json
git commit -m "feat: add cancelled status translations (tr + en)"
```

---

### Task 3: Frontend — DownloadForm cancel butonu

**Files:**
- Modify: `src/components/download/DownloadForm.tsx`

**Interfaces:**
- Consumes: `DELETE /api/downloads/[id]` → `{ ok: true }`
- Consumes: `t("download.cancel")`, `t("download.cancelling")`, `t("download.cancelled")`, `t("download.new")`

- [ ] **Step 1: `Phase` tipine `cancelled` ekle ve state/handler yaz**

`Phase` union tipini güncelle:
```typescript
type Phase =
  | { type: "idle" }
  | { type: "fetching" }
  | { type: "ready"; url: string; info: VideoInfo }
  | { type: "downloading"; downloadId: string; title: string | null; percent: number; speed: string | null; eta: string | null }
  | { type: "completed"; downloadId: string; title: string | null; token: string }
  | { type: "cancelled" }
  | { type: "error"; message: string };
```

`isCancelling` state'i ekle (mevcut `isStarting` yanına):
```typescript
const [isCancelling, setIsCancelling] = useState(false);
```

`handleCancel` fonksiyonunu ekle (mevcut `handleReset` fonksiyonunun üstüne):
```typescript
async function handleCancel() {
  if (phase.type !== "downloading" || isCancelling) return;
  const downloadId = phase.downloadId;
  setIsCancelling(true);
  esRef.current?.close();
  try {
    await fetch(`/api/downloads/${downloadId}`, { method: "DELETE" });
  } catch { /* hata sessizce geçilir */ }
  setIsCancelling(false);
  setPhase({ type: "cancelled" });
}
```

- [ ] **Step 2: `downloading` aşamasına cancel butonu ekle**

Mevcut `downloading` render bloğunu şu şekilde güncelle — progress bar altındaki stat satırına cancel butonu ekle:

```tsx
{phase.type === "downloading" && (
  <div className="space-y-3">
    {phase.title && (
      <p className="text-sm font-medium truncate">{phase.title}</p>
    )}
    <div className="space-y-1.5">
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-[width] duration-500"
          style={{ width: `${Math.max(2, phase.percent)}%` }}
        />
      </div>
      <div className="flex justify-between items-center text-xs text-muted-foreground">
        <span>{phase.percent.toFixed(1)}%</span>
        <div className="flex items-center gap-3">
          <span>
            {[
              phase.speed,
              phase.eta ? `${phase.eta} kaldı` : null,
            ]
              .filter(Boolean)
              .join(" — ")}
          </span>
          <button
            onClick={handleCancel}
            disabled={isCancelling}
            className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isCancelling ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              t("cancel")
            )}
          </button>
        </div>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 3: `cancelled` aşaması render'ı ekle**

Mevcut `{/* Hata */}` bloğunun üstüne ekle:

```tsx
{/* İptal edildi */}
{phase.type === "cancelled" && (
  <div className="space-y-3">
    <p className="text-sm text-muted-foreground">{t("cancelled")}</p>
    <Button variant="outline" size="lg" onClick={handleReset} className="w-full">
      {t("new")}
    </Button>
  </div>
)}
```

- [ ] **Step 4: `isCancelling` state'ini `handleReset` içinde sıfırla**

Mevcut `handleReset` fonksiyonuna `setIsCancelling(false)` satırını ekle:

```typescript
function handleReset() {
  esRef.current?.close();
  setPhase({ type: "idle" });
  setUrl("");
  setSelectedQuality(null);
  setSelectedVcodec(null);
  setSelectedContainer("mp4");
  setSelectedAcodec("auto");
  setIsCancelling(false);
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/download/DownloadForm.tsx
git commit -m "feat: add cancel button to download progress UI"
```

---

### Task 4: Frontend — DownloadHistory `cancelled` statüsü

**Files:**
- Modify: `src/components/download/DownloadHistory.tsx`

**Interfaces:**
- Consumes: `t("history.filterCancelled")`, `t("history.cancelled")`

- [ ] **Step 1: `STATUS_FILTER_KEYS` ve filtre güncelle**

```typescript
const STATUS_FILTER_KEYS = ["all", "completed", "error", "cancelled", "expired"] as const;
type StatusFilter = (typeof STATUS_FILTER_KEYS)[number];
```

`filtered` useMemo içindeki `effectiveStatus` mantığını güncelle:
```typescript
const effectiveStatus =
  dl.status === "completed" && dl.expiresAt && new Date(dl.expiresAt) <= new Date()
    ? "expired"
    : dl.status;
```
Bu zaten `cancelled`'ı doğru şekilde geçirir, ek değişiklik gerekmez.

- [ ] **Step 2: `cancelled` badge render'ı ekle**

List item içindeki `shrink-0` div'indeki mevcut `isActive/canDownload/error/expired` zincirini güncelle:

```tsx
<div className="shrink-0">
  {isActive ? (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Loader2 className="size-3.5 animate-spin" />
      {t("downloading")}
    </span>
  ) : canDownload ? (
    <a href={`/api/downloads/${dl.id}/file?token=${dl.token}`}>
      <Button size="icon-sm" variant="outline" aria-label="İndir">
        <Download className="size-3.5" />
      </Button>
    </a>
  ) : dl.status === "error" ? (
    <span className="flex items-center gap-1 text-xs text-destructive">
      <AlertCircle className="size-3.5" />
      {t("error")}
    </span>
  ) : dl.status === "cancelled" ? (
    <span className="flex items-center gap-1 text-xs text-muted-foreground/60">
      <X className="size-3.5" />
      {t("cancelled")}
    </span>
  ) : (
    <span className="flex items-center gap-1 text-xs text-muted-foreground/60">
      <Clock className="size-3.5" />
      {t("expired")}
    </span>
  )}
</div>
```

Not: `X` ikonu zaten import edilmiş (`lucide-react`).

- [ ] **Step 3: Filtre butonunun çevirisini kontrol et**

Mevcut filtre render'ı `t(\`filter${key.charAt(0).toUpperCase() + key.slice(1)}\`)` formatını kullanıyor. `filterCancelled` key'i eklediğimiz için otomatik çalışır.

- [ ] **Step 4: Commit**

```bash
git add src/components/download/DownloadHistory.tsx
git commit -m "feat: show cancelled status in download history"
```

---

### Task 5: Admin — `cancelled` statüs badge

**Files:**
- Modify: `src/components/admin/AdminDashboard.tsx`

**Interfaces:**
- Consumes: `t("admin.statusCancelled")`

- [ ] **Step 1: `StatusBadge` bileşenini güncelle**

`AdminDashboard.tsx` içindeki `StatusBadge` fonksiyonundaki `map` ve `labels` objelerine `cancelled` ekle:

```typescript
const map: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
  approved: "bg-green-500/15 text-green-600 dark:text-green-400",
  blocked: "bg-destructive/15 text-destructive",
  downloading: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  completed: "bg-green-500/15 text-green-600 dark:text-green-400",
  error: "bg-destructive/15 text-destructive",
  expired: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
};
const labels: Record<string, string> = {
  pending: t("statusPending"),
  approved: t("statusApproved"),
  blocked: t("statusBlocked"),
  downloading: t("statusDownloading"),
  completed: t("statusCompleted"),
  error: t("statusError"),
  expired: t("statusExpired"),
  cancelled: t("statusCancelled"),
};
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/AdminDashboard.tsx
git commit -m "feat: add cancelled status badge to admin panel"
```

---

### Task 6: Push ve deploy

- [ ] **Step 1: Push**

```bash
git push origin main
```

CI/CD otomatik deploy eder. GitHub Actions → SSH → git pull → docker compose build → up.

- [ ] **Step 2: Prodüksiyon testi**

1. Bir video URL'si gir, formatı seç, indirmeyi başlat
2. İndirme aşamasında "Cancel" / "İptal Et" butonuna tıkla
3. Sunucuda `/downloads/` dizininde kalıntı dosya kalmadığını doğrula
4. Geçmiş listesinde "İptal edildi" badge'inin göründüğünü kontrol et
5. Admin panelinde de `cancelled` badge'inin göründüğünü kontrol et
