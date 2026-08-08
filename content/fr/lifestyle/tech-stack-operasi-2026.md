---
title: "Stack Teknologi 2026: Operasi Harian Tim Roibase"
description: "Linear, Notion, Slack, Figma, Granola — pola integrasi dan angka sebenarnya dari operasi tim asinkron-first. Pembelajaran sistemik dari 8 tahun kepemimpinan tim."
publishedAt: 2026-08-08
modifiedAt: 2026-08-08
category: lifestyle
i18nKey: lifestyle-004-2026-08
tags: [tech-stack, async-first, linear, notion, operasi-tim]
readingTime: 8
author: Roibase
---

Pasar perangkat lunak produktivitas mencapai 94 miliar dolar di 2026 — namun sebagian besar tim masih menggunakan tools "sebagaimana adanya". Di Roibase, selama 8 tahun terakhir kami mempelajari hal ini: pemilihan tool bukan yang mengubah operasi, melainkan pola integrasi. Velocity sprint Linear kami meningkat dari 2,8 menjadi 4,1 — karena kami merancang ulang stack teknologi sesuai disiplin tim. Dalam artikel ini, kami akan menunjukkan 5 tools yang membentuk operasi harian kami dan bagaimana mereka saling terhubung.

## Linear: Bukan Manajemen Tugas, Melainkan Pencatatan Keputusan

Linear bukan hanya kami gunakan untuk melacak pekerjaan — setiap issue adalah dokumentasi dari titik keputusan. Pada Februari 2025, rata-rata cycle time adalah 4,2 hari. Pada Juli 2026, turun menjadi 2,7 hari. Penyebabnya: kami merancang ulang template issue dari "apa yang akan dikerjakan" menjadi "mengapa hal ini dikerjakan".

Setiap issue Linear membawa metadata ini: `impact` (low/medium/high), `confidence` (0-100%), `effort` (XS-XL). Ketiga elemen ini mengikat prioritas roadmap dari asumsi subjektif ke matriks terukur. Yang penting: metadata ini diisi saat issue dibuat — metadata yang ditambahkan kemudian mengalami kehilangan kredibilitas 80%.

Melalui API Linear, automasi mingguan kami berfungsi: Setiap Jumat pukul 17:00, bot `notion-automation` mendorong issue yang diselesaikan dalam minggu itu ke halaman "Weekly Digest" di Notion. Format: judul, waktu penutupan, orang yang ditugaskan, skor dampak. Dengan demikian, retrospektif sprint dimulai berdasarkan data — bukan pertanyaan "Apa yang kami lakukan minggu ini?" melainkan "Issue mana yang memiliki cycle time di atas ekspektasi?"

### Disiplin Standup Asinkron

Komentar issue Linear adalah mekanisme standup asinkron kami. Tidak ada pertemuan harian — sebaliknya, setiap anggota tim memperbarui issuenya sendiri antara pukul 10:00-11:00. Template: "Kemarin: X selesai, Hari ini: Y direncanakan, Pemblokir: Z atau tidak ada". Disiplin ini mengurangi biaya context switching sebesar 40% (menurut data RescueTime). Blok deep work tetap tidak terputus — notifikasi Slack hanya aktif saat ada mention.

## Notion: Single Source of Truth, Namun Berdisiplin

Workspace Notion kami memiliki lebih dari 230 halaman — namun tidak berlebihan. Setiap halaman memiliki "owner" yang ditunjuk, dan audit dilakukan setiap 3 bulan. "Orphan pages" (tidak dibuka selama 6 bulan) secara otomatis diarsipkan. Tanpa disiplin ini, Notion akan berubah menjadi gudang sampah.

Skenario penggunaan Notion yang paling penting: briefing klien. Ketika proyek baru tiba, halaman `projects/client-slug/brief.md` dibuka. Konten: target, timeline, metrik kesuksesan, log asumsi. Halaman ini terhubung ke Linear (sebagai properti). Saat membuat issue, "Brief link" adalah field wajib — sehingga setiap task dapat dengan cepat menunjukkan "mengapa hal ini ada".

Kami tidak menggunakan fitur database Notion untuk pelacakan pekerjaan — Linear sudah ada untuk itu. Notion hanya untuk "konteks jangka panjang". Misalnya: [strategi penempatan merek](https://www.roibase.com.tr/fr/branding) klien selama 12 bulan tinggal di Notion, namun setiap deliverable sprint ada di Linear. Notion adalah "mengapa", Linear adalah "apa".

## Slack: Hub Integrasi, Percakapan Asinkron

Kami tidak menggunakan Slack sebagai chat real-time — melainkan sebagai hub integrasi + messaging asinkron. Budaya channel kami: `#linear-updates`, `#figma-comments`, `#github-activity`, `#analytics-alerts`. Channel-channel ini adalah feed otomatis — tidak ada percakapan manusia. Disiplin thread: pesan diletakkan di thread, main channel tidak membanjir notifikasi.

Integrasi Slack App kami diatur berdasarkan target numerik:
- **Bot Linear:** Setiap issue ditutup, `#linear-updates` mendapat push. Format disesuaikan — hanya issue dengan impact tinggi yang memicu mention.
- **Webhook Figma:** Saat designer mempublikasikan komponen, `#figma-comments` mendapat update. Frontend dev mendapat konteks dari sana.
- **GitHub Actions:** Saat PR di-merge, `#github-activity` menunjukkan issue Linear apa yang ditutup.

Dengan demikian, Slack menjadi dashboard pasif di mana anggota tim menjawab pertanyaan "apa yang sedang terjadi". Untuk bertanya, daripada DM, thread dibuka — sehingga konteks dapat ditelusuri kemudian.

### SLA Waktu Respons

Tidak ada tekanan untuk segera membalas pesan Slack. SLA: pesan dengan mention dijawab dalam 4 jam, thread tanpa mention dalam 24 jam. Disiplin ini terlihat di RescueTime: durasi sesi Slack rata-rata turun dari 12 menit menjadi 6 menit. Deep work terlindungi.

## Figma: Bukan Desain, Melainkan Dokumentasi Konsensus

Kami tidak hanya menggunakan Figma untuk desain UI — melainkan untuk dokumentasi konsensus keputusan. Contoh: setelah brief klien ditulis di Notion, wireframe digambar di Figma. File Figma terhubung ke issue Linear. Saat developer mengimplementasikan, pertanyaan "mengapa desain ini dibuat seperti ini" terjawab di komentar Figma.

Fitur branch Figma menyelamatkan: setiap perubahan besar diuji di branch, file utama tetap bersih. Saat developer mengimplementasikan, "versi terakhir yang disetujui" selalu ada di branch utama. Disiplin ini menghilangkan kesalahan "saya mengimplementasikan versi yang salah".

Plugin Figma kami: `A11y - Color Contrast Checker`, `Stark`. Sebelum desain dipublikasikan, audit aksesibilitas wajib. Rasio kontras warna di bawah 4,5:1 tidak disetujui. Disiplin ini menghasilkan compliance WCAG 100% di production.

## Granola: Otomasi Catatan Pertemuan

Granola bergabung dengan stack teknologi kami di paruh kedua 2025. Skenario penggunaan: panggilan klien dan sinkronisasi internal. Granola mentranskrip pertemuan, kemudian diringkas dengan GPT-4. Output didorong langsung ke Notion — format `meetings/YYYY-MM-DD-client-name`.

Yang penting: kami tidak menggunakan output Granola mentah. Dalam 10 menit setelah pertemuan, owner (biasanya meeting lead) mengedit halaman Notion: ringkasan dipertahankan, action item dikonversi ke issue Linear, bagian yang tidak relevan dihapus. Jika transkrip mentah dibiarkan di Notion, data sampah terbentuk — hasil pencarian menjadi kotor.

ROI Granola: beban pencatatan pertemuan berkurang 70%. Sebelumnya, setelah setiap panggilan dihabiskan 15-20 menit membersihkan catatan secara manual. Sekarang transkripsi otomatis, waktu pembersihan 5-7 menit. Dengan 120+ panggilan klien per tahun, ini berarti penghematan 30+ jam.

## Pola-Pola Integrasi

Kekuatan stack teknologi terletak bukan pada tool individu, melainkan pada desain layer integrasi. Pola-pola kami:

**Alur Linear → Notion:** Setelah setiap siklus Linear selesai, issue yang diselesaikan didorong ke digest sprint Notion. Bukan manual, tapi automasi Zapier. Pemicu: Linear cycle close. Format: tabel markdown — judul issue, owner, cycle time, dampak.

**Alur Figma → Linear:** Ketika file Figma diberi tag "Ready for Dev", issue Linear otomatis dibuka. Body issue berisi Figma file link + komentar terakhir tertanam. Dengan demikian developer tidak mengalami kehilangan konteks.

**Alur Slack → Linear:** Di channel `#requests`, jika ada emoji reaction tertentu (`:fire:`), pesan otomatis berubah menjadi issue Linear. Judul issue adalah baris pertama pesan, body adalah seluruh thread. Dengan demikian request ad-hoc tidak hilang.

**Alur GitHub → Notion:** Saat PR di-merge, tag "Completed" otomatis ditambahkan ke halaman brief Notion yang terkait. Dengan demikian halaman brief tetap aktual — pertanyaan "apakah fitur ini selesai?" menemukan jawaban dari Notion.

## Kegagalan Sistem dan Pemulihan

Desember 2025, Slack mengalami pemadaman — 6 jam tanpa messaging. Apakah operasi tim terhenti? Tidak. Karena pelacakan pekerjaan sebenarnya ada di Linear, dokumentasi di Notion. Slack hanya notification layer. Selama pemadaman, tim beralih ke komentar Linear, alur terus berlanjut.

Pembelajaran dari pengalaman ini: dalam desain stack teknologi, tidak boleh ada single point of failure. Setiap tool tidak memiliki backup, namun setiap tool memiliki tanggung jawab sempit. Jika Slack hilang, Linear comments digunakan; jika Linear hilang, database Notion menjadi manajemen task manual. Fleksibilitas ini membuat risiko ketergantungan tool rendah.

---

Operasi stack teknologi bukanlah sistem yang diatur sekali dan dilupakan — melainkan disiplin yang diaudit setiap kuartal, dan sebelum menambah tool baru, perhitungan "biaya integrasi vs manfaat" selalu dilakukan. Stack Roibase di 2026 terbentuk dengan disiplin ini. Stack yang tepat untuk tim Anda mungkin berbeda — namun biaya menambah tool tanpa menetapkan pola integrasi akan selalu tinggi. Mengubah tool mudah, mengubah sistem sulit.