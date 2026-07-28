#!/bin/bash
# HuurGo — Resend e-posta yardımcıları (watchdog.sh ve backup-db.sh tarafından
# ortak kullanılır). Doğrudan çalıştırılmaz, diğer scriptler `source` eder.
#
# Uygulamanın zaten kullandığı Resend hesabını yeniden kullanır — .env'de
# RESEND_API_KEY/EMAIL_FROM tanımlıysa oradan okur, tanımlı değilse e-posta
# gönderimini sessizce atlar (çağıran script asla bu yüzden çökmez).
#
# ÖNEMLİ: .env'de aynı anahtar birden fazla kez tanımlıysa (örn. eski/boş bir
# satır kalmışsa) SON satır esas alınır — Node'un dotenv paketinin davranışıyla
# birebir aynı, yani uygulamanın gerçekte kullandığı değerle bu script'in
# okuduğu değer her zaman eşleşir. (İlk sürümde `head -1` kullanılıyordu ve
# .env'de rastlanan boş bir yinelenen satır yüzünden e-posta hiç gitmiyordu.)

APP_DIR="${APP_DIR:-/opt/huurgo}"
ALERT_EMAIL="${ALERT_EMAIL:-huurgomb@gmail.com}"
RESEND_API_KEY=""
EMAIL_FROM="onboarding@resend.dev"

if [ -f "$APP_DIR/.env" ]; then
  val=$(grep -E '^RESEND_API_KEY=' "$APP_DIR/.env" | tail -1 | cut -d'=' -f2-)
  [ -n "$val" ] && RESEND_API_KEY="$val"
  val=$(grep -E '^EMAIL_FROM=' "$APP_DIR/.env" | tail -1 | cut -d'=' -f2-)
  [ -n "$val" ] && EMAIL_FROM="$val"
fi

# send_alert <konu> <govde>
# Basit metin e-postası gönderir. RESEND_API_KEY yoksa veya Resend'in yanıtı
# başarıyı göstermiyorsa (yanıt gövdesinde "id" alanı yoksa) 1 döner — curl'un
# kendi çıkış koduna güvenmiyoruz çünkü curl, geçersiz bir API anahtarına 401
# dönen bir istekte bile transfer başarıyla tamamlandığı için 0 ile çıkar.
send_alert() {
  local subject="$1" body="$2" resp
  if [ -z "$RESEND_API_KEY" ]; then
    echo "BILGI: RESEND_API_KEY tanimli degil, '$subject' icin e-posta gonderilemedi."
    return 1
  fi
  resp=$(curl -s -m 15 -X POST "https://api.resend.com/emails" \
    -H "Authorization: Bearer ${RESEND_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"from\":\"${EMAIL_FROM}\",\"to\":[\"${ALERT_EMAIL}\"],\"subject\":\"${subject}\",\"text\":\"${body}\"}")
  echo "$resp"
  echo "$resp" | grep -q '"id"'
}

# send_alert_with_attachment <konu> <govde> <dosya-yolu> [max-boyut-bayt]
# Dosyayı base64'e çevirip e-posta ekine koyar (Resend attachments API'si).
# Dosya max-boyut-bayt'tan büyükse (varsayılan 20MB — Resend'in ~40MB toplam
# mesaj sınırına base64'ün ~%33 şişmesi payı bırakılarak) göndermeyi atlar,
# hata olarak değil bilgi olarak loglar.
send_alert_with_attachment() {
  local subject="$1" body="$2" file="$3" max_bytes="${4:-20971520}"
  if [ -z "$RESEND_API_KEY" ]; then
    echo "BILGI: RESEND_API_KEY tanimli degil, '$subject' eki gonderilemedi."
    return 1
  fi
  if [ ! -f "$file" ]; then
    echo "HATA: gonderilecek dosya bulunamadi: $file"
    return 1
  fi
  local size_bytes
  size_bytes=$(stat -c%s "$file" 2>/dev/null || echo 0)
  if [ "$size_bytes" -gt "$max_bytes" ]; then
    echo "BILGI: $(basename "$file") $((size_bytes / 1024 / 1024))MB, e-posta ekine gore cok buyuk (limit $((max_bytes / 1024 / 1024))MB) - sadece sunucuda duruyor."
    return 1
  fi
  local filename tmp_payload resp
  filename=$(basename "$file")
  tmp_payload=$(mktemp)
  # JSON gövdesini geçici bir dosyaya yaz, komut satırı argümanı olarak DEĞİL.
  # Base64 içerik birkaç MB'a kolayca çıkar; curl'a -d "..." ile (bir process
  # argümanı olarak) verirsek kernel'in tek argüman için koyduğu üst sınırı
  # (ARG_MAX, tipik olarak ~2MB) aşıp "Argument list too long" hatası alırız —
  # tam olarak 28 Temmuz'daki ilk canlı denemede olan buydu. Dosyadan okumanın
  # (-d @dosya) böyle bir sınırı yok.
  {
    printf '{"from":"%s","to":["%s"],"subject":"%s","text":"%s","attachments":[{"filename":"%s","content":"' \
      "$EMAIL_FROM" "$ALERT_EMAIL" "$subject" "$body" "$filename"
    base64 -w0 "$file"
    printf '"}]}'
  } > "$tmp_payload"

  resp=$(curl -s -m 60 -X POST "https://api.resend.com/emails" \
    -H "Authorization: Bearer ${RESEND_API_KEY}" \
    -H "Content-Type: application/json" \
    -d @"$tmp_payload")
  rm -f "$tmp_payload"
  echo "$resp"
  echo "$resp" | grep -q '"id"'
}
