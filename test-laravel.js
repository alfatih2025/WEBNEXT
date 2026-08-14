fetch('https://backendnexa-production-adce.up.railway.app/api/sensor-data')
  .then(res => res.text())
  .then(console.log);
