export const ARDUINO_FORMULA_REFERENCE = `
RUMUS ARDUINO NANO YANG WAJIB DIIKUTI:
void hitungSkor() {
  if (isnan(suhu) || isnan(kelembapan) || isnan(tanah) || suhu == 0.0 || kelembapan == 0.0) return;

  float svp = 0.6108 * exp((17.27 * suhu) / (suhu + 237.3));
  vdp = svp * (1.0 - (kelembapan / 100.0));
  vdp = constrain(vdp, 0.4, 2.0);

  if (Atas - Kritis == 0) Kritis = Atas - 1;

  skorTanah = ((Atas - tanah) * 50.0) / (Atas - Kritis);
  skorTanah = constrain(skorTanah, 0, 50);

  skorvdp = ((vdp - 0.4) * 30.0) / (2.0 - 0.4);

  skorHujan = (peluangHujan / 100.0) * 40.0;
  skorHujan = constrain(skorHujan, 0, 40);

  skorInteraksi = ((skorTanah * skorvdp) / 50.0) * 0.667;
  skorInteraksi = constrain(skorInteraksi, 0, 30);

  skorTotal = skorTanah + skorvdp + skorInteraksi - skorHujan;
  durasiOff = durasiOn * (1.0 + ((Atas - tanah) / 100.0));
}

Rumus ini menghitung:
- VPD (Vapor Pressure Deficit) dari suhu dan kelembapan
- skorTanah: 0-50 berdasarkan posisi tanah antara Kritis-Atas
- skorvdp: 0-30 berdasarkan VPD (0.4-2.0 kPa)
- skorHujan: 0-40 berdasarkan peluang hujan BMKG
- skorInteraksi: 0-30 berdasarkan interaksi tanah&VPD (faktor 0.667)
- skorTotal: 0-100 (total skor akhir)
- durasiOff: jeda pematian pompa berdasarkan kebutuhan air

Gunakan rumus di atas secara konsisten saat menjelaskan perhitungan.
`.trim();

export function getArduinoFormulaReference(): string {
  return ARDUINO_FORMULA_REFERENCE;
}
