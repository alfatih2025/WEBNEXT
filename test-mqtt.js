import mqtt from 'mqtt';

const brokerUrl = 'mqtts://a4e9379a555f47669c90f4c69b75eeda.s1.eu.hivemq.cloud:8883';
const client = mqtt.connect(brokerUrl, {
  username: 'NexaGrowv2',
  password: 'NexaGrow12345'
});

client.on('connect', () => {
  console.log('Connected, sending test data...');
  const payload = {
    node_id: 1,
    temperature: 25.5,
    humidity: 60.2,
    soil_moisture: 45.1,
    created_at: new Date().toISOString()
  };
  client.publish('sproutai/sensor/node/1', JSON.stringify(payload), { qos: 1 }, (err) => {
    if (err) console.error(err);
    else console.log('Test data sent successfully!');
    client.end();
  });
});
