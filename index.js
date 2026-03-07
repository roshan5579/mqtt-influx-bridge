const mqtt = require("mqtt");
const axios = require("axios");

// ================= MQTT CONFIG =================
const MQTT_BROKER = "mqtts://01792b66dfee4540a546dc894922fb94.s1.eu.hivemq.cloud:8883";
const MQTT_TOPIC = "tractor/data";

const client = mqtt.connect(MQTT_BROKER,{
  username: "MR_TRACTOR",
  password: "#Lokesh000"
});

// ================= INFLUX CONFIG =================
const INFLUX_URL = "https://YOUR_INFLUX_URL/api/v2/write?bucket=YOUR_BUCKET&org=YOUR_ORG&precision=s";
const TOKEN = "YOUR_INFLUX_TOKEN";

// ================= MQTT CONNECT =================
client.on("connect", () => {
  console.log("Connected to HiveMQ Cloud");
  client.subscribe(MQTT_TOPIC);
});

// ================= DATA RECEIVED =================
client.on("message", async (topic, message) => {

  console.log("MQTT Data:", message.toString());

  const data = JSON.parse(message.toString());

  const line = `tractor voltage=${data.voltage},current=${data.current}`;

  try {

    await axios.post(INFLUX_URL, line, {
      headers:{
        Authorization:`Token ${TOKEN}`,
        "Content-Type":"text/plain"
      }
    });

    console.log("Data written to InfluxDB");

  } catch(err) {

    console.log("InfluxDB Error:",err);

  }

});
