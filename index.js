const mqtt = require("mqtt");
const axios = require("axios");

// ================= MQTT CONFIG =================
const MQTT_BROKER = "mqtts://01792b66dfee4540a546dc894922fb94.s1.eu.hivemq.cloud:8883";
const MQTT_TOPIC = "tractor/data";

const client = mqtt.connect(MQTT_BROKER,{
  username: "MR_TRACTOR",
  password: "#Lokesh000"
});

// ================= INFLUXDB CONFIG =================
const INFLUX_URL = "https://eu-central-1-1.aws.cloud2.influxdata.com/api/v2/write?org=Moonrider%20Pvt%20Ltd&bucket=Tractor_Data&precision=s";

const TOKEN = "BLjKjM_zGG5u2HJkw1uPusEjzSjbdYee8JvC_TqUnS-21z6ckYoIoXrJH8Dc3TmeGm2Vr71uQoB5xs3Uz69y8w==";

// ================= MQTT CONNECT =================
client.on("connect", () => {

  console.log("Connected to HiveMQ");

  client.subscribe(MQTT_TOPIC);

});

// ================= MQTT DATA =================
client.on("message", async (topic, message) => {

  console.log("Received:", message.toString());

  try {

    const data = JSON.parse(message.toString());

    const line = `tractor voltage=${data.voltage},current=${data.current}`;

    await axios.post(INFLUX_URL, line, {
      headers:{
        "Authorization": `Token ${TOKEN}`,
        "Content-Type": "text/plain"
      }
    });

    console.log("Data sent to InfluxDB");

  } catch(err) {

    console.log("Error:", err);

  }

});
