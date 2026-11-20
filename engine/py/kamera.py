# Yayın kesitinde yayıncının kamerasını (facecam) bulur: kareler boyunca SABİT duran yüz = kamera
# (oyundaki karakter yüzleri hareket eder). Çıktı: {"x","y","w","h"} (0-1, kaynak karesine göre) ya da null.
# Kullanım: python kamera.py <video> <çıktı.json>
import json, sys
import cv2

src, out = sys.argv[1], sys.argv[2]
cap = cv2.VideoCapture(src)
n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 1
W, H = cap.get(cv2.CAP_PROP_FRAME_WIDTH), cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
yuz = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
ornek = 16
kutular = []
for i in range(ornek):
    cap.set(cv2.CAP_PROP_POS_FRAMES, int(n * (i + 0.5) / ornek))
    ok, kare = cap.read()
    if not ok:
        continue
    gri = cv2.cvtColor(kare, cv2.COLOR_BGR2GRAY)
    for (x, y, w, h) in yuz.detectMultiScale(gri, 1.1, 5, minSize=(int(H * 0.04), int(H * 0.04))):
        kutular.append((i, (x + w / 2) / W, (y + h / 2) / H, w / W))

# Kümele: merkezi birbirine 0,05 yakın yüzler aynı yer; en çok karede görünen küme kamera
kumeler = []
for k in kutular:
    for c in kumeler:
        if abs(c["x"] - k[1]) < 0.05 and abs(c["y"] - k[2]) < 0.05:
            c["kareler"].add(k[0]); c["w"].append(k[3]); break
    else:
        kumeler.append({"x": k[1], "y": k[2], "w": [k[3]], "kareler": {k[0]}})
kumeler.sort(key=lambda c: -len(c["kareler"]))
sonuc = None
if kumeler and len(kumeler[0]["kareler"]) >= ornek * 0.35:
    c = kumeler[0]
    fw = sorted(c["w"])[len(c["w"]) // 2]
    cw = min(0.5, max(0.16, fw * 4.2))           # kamera kutusu genişliği (yüzün ~4 katı)
    ch = cw * (W / H) / (1080 / 640)             # 1080x640 hedef kutunun en-boy oranı
    x = min(max(0, c["x"] - cw / 2), 1 - cw)
    y = min(max(0, c["y"] - ch * 0.42), 1 - ch)
    sonuc = {"x": round(x, 4), "y": round(y, 4), "w": round(cw, 4), "h": round(ch, 4), "kare": len(c["kareler"])}
json.dump(sonuc, open(out, "w"))
print(sonuc)
