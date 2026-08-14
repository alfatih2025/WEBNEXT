const supabaseUrl = 'https://awhiuhjnxrohmvvomile.supabase.co/rest/v1/sensor_data';
const supabaseKey = 'sb_publishable_W_IaTg13a74JwPcHuWtgSQ_wq36aSg1';

async function checkData() {
  console.log("Checking Supabase using REST API...");
  try {
    const res = await fetch(`${supabaseUrl}?select=*&order=created_at.desc&limit=3`, {
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!res.ok) {
      console.error(`Error ${res.status}: ${res.statusText}`);
      const text = await res.text();
      console.error(text);
      return;
    }
    
    const data = await res.json();
    console.log("Data found:", data.length, "rows.");
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}

checkData();
