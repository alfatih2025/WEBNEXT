const SEMARANG_DISTRICT_MAP = {
  '33.74.01': 'Semarang Tengah',
  '33.74.02': 'Semarang Utara',
  '33.74.03': 'Semarang Timur',
  '33.74.04': 'Gayamsari',
  '33.74.05': 'Genuk',
  '33.74.06': 'Pedurungan',
  '33.74.07': 'Semarang Selatan',
  '33.74.08': 'Candisari',
  '33.74.09': 'Gajahmungkur',
  '33.74.10': 'Tembalang',
  '33.74.11': 'Banyumanik',
  '33.74.12': 'Gunungpati',
  '33.74.13': 'Semarang Barat',
  '33.74.14': 'Mijen',
  '33.74.15': 'Ngaliyan',
  '33.74.16': 'Tugu',
  '33.22.01': 'Getasan',
  '33.22.02': 'Tengaran',
  '33.22.03': 'Susukan',
  '33.22.04': 'Suruh',
  '33.22.05': 'Pabelan',
  '33.22.06': 'Tuntang',
  '33.22.07': 'Banyubiru',
  '33.22.08': 'Jambu',
  '33.22.09': 'Sumowono',
  '33.22.10': 'Ambarawa',
  '33.22.11': 'Bawen',
  '33.22.12': 'Bringin',
  '33.22.13': 'Bergas',
  '33.22.15': 'Pringapus',
  '33.22.16': 'Bancak',
  '33.22.17': 'Kaliwungu',
  '33.22.18': 'Ungaran Barat',
  '33.22.19': 'Ungaran Timur',
  '33.22.20': 'Bandungan',
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(body),
  };
}

function resolveSemarangDistrict(code) {
  const districtCode = String(code || '').trim();
  const label = SEMARANG_DISTRICT_MAP[districtCode];
  if (!label) return null;
  return { districtCode, label };
}

function parseLocationLinks(html, districtCode, districtLabel) {
  const items = new Map();
  const pattern = /<a[^>]+href="[^"]*\/cuaca\/prakiraan-cuaca\/([\d.]+)[^"]*"[^>]*>(.*?)<\/a>/gi;

  let match;
  while ((match = pattern.exec(html)) !== null) {
    const code = match[1];
    const rawLabel = match[2]
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();

    if (!code.startsWith(`${districtCode}.`)) continue;
    if (!/^\d{2}(?:\.\d{2}){1,2}(?:\.\d{1,4})?$/.test(code)) continue;
    if (!rawLabel || /prakiraan|cuaca|bmkg|kecamatan/i.test(rawLabel)) continue;

    items.set(code, {
      code,
      label: rawLabel,
      province: 'Jawa Tengah',
      city: 'Kota Semarang',
      district: districtLabel,
      village: rawLabel,
      category: 'semarang',
      level: 'village',
      parentCode: districtCode,
      ready: true,
    });
  }

  return Array.from(items.values());
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const districtCode = String(req.query?.district || '').trim();
    const district = resolveSemarangDistrict(districtCode);
    if (!district) {
      return res.status(200).json({ items: [] });
    }

    const response = await fetch(`https://www.bmkg.go.id/cuaca/prakiraan-cuaca/${encodeURIComponent(districtCode)}`);
    if (!response.ok) {
      return res.status(200).json({
        districtCode,
        districtLabel: district.label,
        items: [
          {
            code: districtCode,
            label: district.label,
            province: 'Jawa Tengah',
            city: 'Kota Semarang',
            district: district.label,
            category: 'semarang',
            level: 'district',
            parentCode: '33.74',
            ready: true,
          },
        ],
      });
    }

    const html = await response.text();
    const items = parseLocationLinks(html, districtCode, district.label);

    return res.status(200).json({
      districtCode,
      districtLabel: district.label,
      items,
    });
  } catch (err) {
    console.error('Weather locations API error:', err);
    return res.status(200).json({ items: [] });
  }
}
