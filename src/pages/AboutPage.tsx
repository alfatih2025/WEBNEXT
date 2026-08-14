
import { Info, Cpu, Radar, Bell, Zap, BookOpen, Activity,Users } from 'lucide-react';

function Feature({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: typeof Info;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-white/60 backdrop-blur border border-green-100 p-4 shadow-sm">
      <div className="mt-1 rounded-xl bg-green-600/10 border border-green-600/20 p-2">
        <Icon size={18} className="text-green-700" />
      </div>
      <div>
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
        <p className="text-sm text-gray-700 leading-relaxed dark:text-gray-300">{description}</p>
      </div>
    </div>
  );
}

export function AboutPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-green-600 to-teal-700 p-6 text-white shadow-lg">
        <div className="flex items-start gap-4">
          <div className="mt-1 rounded-2xl bg-white/15 border border-white/20 p-3">
            <Info size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">About / Tentang Web IoT NexaGrow</h1>
            <p className="text-green-100 mt-2 max-w-3xl">
              NexaGrow adalah platform monitoring tanaman berbasis IoT yang membantu petani menjaga kondisi pertumbuhan lebih konsisten melalui
              data sensor, kontrol perangkat, dan dukungan analitik.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl bg-white/70 backdrop-blur border border-green-100 p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Arti “NexaGrow”</h2>
          <p className="text-sm text-gray-700 leading-relaxed mt-3 dark:text-gray-300">
            <span className="font-semibold">Nexa</span> menggambarkan konektivitas dan kecerdasan berbasis data,
            sedangkan <span className="font-semibold">Grow</span> merepresentasikan tujuan utama: membantu tanaman tumbuh optimal.
            Gabungan keduanya menjadikan NexaGrow sebagai “otak” digital untuk pertumbuhan tanaman yang terukur dan lebih efisien.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <span className="px-3 py-1 rounded-full bg-green-600/10 border border-green-600/20 text-green-800 text-sm font-medium">
              IoT Monitoring
            </span>
            <span className="px-3 py-1 rounded-full bg-green-600/10 border border-green-600/20 text-green-800 text-sm font-medium">
              Kontrol Otomatis
            </span>
            <span className="px-3 py-1 rounded-full bg-green-600/10 border border-green-600/20 text-green-800 text-sm font-medium">
              Efisiensi Air
            </span>
          </div>
        </div>

        <div className="rounded-2xl bg-white/70 backdrop-blur border border-green-100 p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Fitur Utama</h2>
          <p className="text-sm text-gray-700 leading-relaxed mt-3 dark:text-gray-300">
            Web NexaGrow dirancang untuk memberi visibilitas real-time, tindakan cepat, dan panduan berbasis AI agar keputusan perawatan
            tanaman lebih tepat.
          </p>
        </div>
      </div>
      <div className="rounded-2xl border border-green-100 bg-white/80 p-6 shadow-sm backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="rounded-xl border border-green-600/20 bg-green-600/10 p-2">
            <Users size={20} className="text-green-700" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Tim Pengembang</h2>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-green-800">Tim C.R.E.S.T</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">(Club Riset Elektronika Stemsa)</p>
            <p className="mt-2 text-base font-bold text-gray-900 dark:text-gray-100">SMK Negeri 1 Semarang</p>
          </div>

          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300">Pembimbing</h4>
            <p className="mt-1 text-sm font-medium text-gray-800 dark:text-gray-100">Rifqi Setiawan S.Pd</p>
          </div>

          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300">Anggota Tim</h4>
            <ul className="mt-2 space-y-1.5 text-sm font-medium text-gray-800 dark:text-gray-100">
              <li>• Habibullah Naja Alfatih Wibowo</li>
              <li>• Raihan Andrean Maulana</li>
              <li>• Ilham Hendro Saputro</li>
            </ul>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Feature
          title="Monitoring Real-time"
          description="Lihat pembacaan sensor (suhu, kelembapan udara, kelembapan tanah, status pompa/lampu) secara berkala dari perangkat ESP32."
          icon={Activity}
        />
        <Feature
          title="Kontrol Perangkat"
          description="Aktifkan atau nonaktifkan perangkat (mis. pompa/lampu) melalui panel kontrol sesuai kebutuhan."
          icon={Zap}
        />
        <Feature
          title="Alert & Notifikasi"
          description="Sistem akan memberi peringatan saat nilai melewati ambang batas (mis. suhu tinggi atau kelembapan tanah rendah)."
          icon={Bell}
        />
        <Feature
          title="Log & Analitik"
          description="Pantau histori dan analisa perubahan data untuk membantu evaluasi perawatan tanaman."
          icon={BookOpen}
        />
        <Feature
          title="AI Chat (NexaBot)"
          description="Gunakan AI untuk mendapatkan saran perawatan dan penjelasan berdasarkan data sensor dan konteks tanaman."
          icon={Radar}
        />
        <Feature
          title="Integrasi MQTT/ESP32"
          description="Komunikasi perangkat IoT menggunakan MQTT agar data sensor tersalurkan ke web dengan cepat dan andal."
          icon={Cpu}
        />
      </div>
    </div>
  );
}
