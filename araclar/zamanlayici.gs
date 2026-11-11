// Google Apps Script: Instagram/TikTok paylaşımını tam yayın saatinde başlatır.
// Kurulum: script.google.com → Yeni proje → bu kodu yapıştır → Proje ayarları → Komut dosyası özellikleri:
//   GITHUB_TOKEN = (GitHub ince ayarlı token: yalnızca yt-otomasyon deposu, Actions: okuma+yazma, Contents: salt okuma)
// Sonra üstteki listeden "kur" fonksiyonunu seçip bir kez Çalıştır (izinleri onayla). Her 5 dakikada bir kontrol eder.
const REPO = '123testere/yt-otomasyon';

function kontrol() {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('GITHUB_TOKEN');
  if (!token) return;
  const r = UrlFetchApp.fetch('https://api.github.com/repos/' + REPO + '/contents/config/sosyal-saatler.json?ref=main', {
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github.raw+json' }, muteHttpExceptions: true,
  });
  if (r.getResponseCode() !== 200) return;
  const saatler = (JSON.parse(r.getContentText()).saatler || []).map(function (s) { return Date.parse(s); });
  const simdi = Date.now();
  const son = Number(props.getProperty('SON') || 0);
  // Saati gelmiş (en fazla 3 saat önce) ve daha önce tetiklenmemiş yayın var mı?
  const vadesi = saatler.filter(function (t) { return t <= simdi + 60000 && t > simdi - 3 * 3600000 && t > son; });
  if (!vadesi.length) return;
  const d = UrlFetchApp.fetch('https://api.github.com/repos/' + REPO + '/actions/workflows/instagram.yml/dispatches', {
    method: 'post', contentType: 'application/json', payload: JSON.stringify({ ref: 'main' }),
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' }, muteHttpExceptions: true,
  });
  if (d.getResponseCode() === 204) props.setProperty('SON', String(Math.max.apply(null, vadesi)));
  else console.log('GitHub tetiklenemedi: ' + d.getResponseCode() + ' ' + d.getContentText());
}

function kur() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('kontrol').timeBased().everyMinutes(5).create();
  kontrol();
}
