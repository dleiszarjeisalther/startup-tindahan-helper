# Startup Tindahan Helper - Marketing Landing Page

An impeccable, high-converting marketing landing page for **Startup Tindahan Helper**, optimized for fast loading, 100% offline-first messaging, and InfinityFree web hosting.

---

## 📁 Directory Structure

```
marketing/website/
├── index.html                  # Main responsive landing page (Tailwind CDN, Lucide, Three.js)
├── gg.php                      # Admin Control Panel (Enable/Disable APK, Set Cloud Link, View signups.txt)
├── download_status.json        # Dynamic toggle state & cloud download URL configuration
├── signups.txt                 # Lead log file (records SUCCESS / UNSUCCESSFUL download status)
├── apk/
│   └── tindahan-helper.apk     # Standalone Android APK (133 MB)
├── api/
│   ├── signup.php              # Logs leads with SUCCESS / UNSUCCESSFUL status to signups.txt
│   └── status.php              # Returns downloads_enabled & download_url status JSON
├── assets/
│   ├── css/
│   │   └── style.css           # Glassmorphism, animations, realistic phone mockup frame
│   ├── js/
│   │   ├── hero-3d.js          # Interactive Three.js 3D background with floating tokens
│   │   └── main.js             # Sign-up modal, autoplay video with sound, cloud download trigger
│   ├── video/
│   │   └── merged_part1_part3.mp4 # Full App Feature Walkthrough & Ad (6.97 MB)
│   └── images/
│       ├── logo.png
│       ├── logo-glow.png
│       ├── favicon.png
│       └── Screenshot_*.jpg    # Real in-app screenshots
└── README.md
```

---

## ☁️ Bakit Hindi Mai-upload ang 133 MB APK sa InfinityFree?

May mahigpit na **10 MB per-file upload limit** ang libreng hosting ng InfinityFree. Dahil ang APK ay **133 MB**, awtomatiko itong irereject o buburahin ng kanilang file scanner kung ia-upload sa `htdocs/apk/`.

Lahat ng ibang files (HTML, CSS, JS, at ang video na `merged_part1_part3.mp4` na 6.97 MB lang) ay **pasok sa 10 MB limit** at walang magiging problema sa InfinityFree!

---

## 🏆 Mga Libreng Alternatibo para sa 133 MB APK

### 1. GitHub Releases (Pinaka-inirerekomenda ⭐)
* **Bakit maganda**: 100% Libre, walang download bandwidth limit, hanggang 2 GB bawat file, mabilis ang CDN sa Pilipinas, at direktang nagda-download ang `.apk` nang walang anumang ads.
* **Paano gawin**:
  1. Gumawa o pumunta sa iyong GitHub repository.
  2. Sa kanang bahagi, i-click ang **Releases** &rarr; **Create a new release** (o Draft a new release).
  3. I-type ang tag version (e.g. `v1.0.0`).
  4. I-drag and drop ang `tindahan-helper.apk` (133 MB).
  5. I-click ang **Publish release**.
  6. Right-click sa na-upload na `.apk` file at piliin ang **Copy link address**.
  7. Pumunta sa iyong website admin panel sa `https://your-domain.infinityfreeapp.com/gg.php`, i-paste ang link sa kahon ng **APK Download Source URL**, at i-click ang **I-save ang APK Link**!

### 2. Google Drive (Direct Download Link)
* **Bakit maganda**: May 15 GB libreng storage at madaling i-upload mula sa browser o phone.
* **Paano gawin**:
  1. I-upload ang `tindahan-helper.apk` sa iyong Google Drive.
  2. Right-click sa file &rarr; **Share** &rarr; baguhin ang General Access sa **"Anyone with the link can view"**.
  3. Kopyahin ang Share link (halimbawa: `https://drive.google.com/file/d/FILE_ID/view?usp=sharing`).
  4. Palitan ang link format para maging direct download:
     `https://drive.google.com/uc?export=download&id=FILE_ID`
  5. I-paste ito sa `gg.php`!

### 3. Dropbox (Direct Link)
* **Paano gawin**:
  1. I-upload ang APK sa Dropbox.
  2. I-click ang **Copy link**.
  3. Sa dulo ng link, palitan ang `?dl=0` ng `?dl=1` (halimbawa: `https://www.dropbox.com/s/.../tindahan-helper.apk?dl=1`).
  4. I-paste ito sa `gg.php`!

### 4. MediaFire
* **Paano gawin**:
  1. I-upload sa [mediafire.com](https://www.mediafire.com).
  2. Kopyahin ang download page link at i-paste sa `gg.php`.

---

## 🛠️ Paano I-set ang Link sa Admin Panel (`gg.php`)

Hindi mo na kailangang magbago ng code!
1. Buksan ang **`https://iyong-website.com/gg.php`**.
2. Hanapin ang bagong section: **"☁️ APK Download Source URL (InfinityFree Alternative)"**.
3. I-paste ang iyong GitHub Release o Google Drive link.
4. I-click ang **"I-save ang APK Link"**.
5. Agad na itong gagamitin ng lahat ng download buttons sa website habang pinapanatili ang:
   * **Sign-up form requirement** bago mag-download.
   * **Pagtatala ng SUCCESS / UNSUCCESSFUL** sa `signups.txt`.
   * **Advisory modal** kapag naka-disable ang download.
