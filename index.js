const mqtt = require("mqtt");
const axios = require("axios");

const MQTT_BROKER = "mqtts://01792b66dfee4540a546dc894922fb94.s1.eu.hivemq.cloud:8883";
const MQTT_TOPIC = "tractor/data";

const INFLUX_URL = "https://eu-central-1-1.aws.cloud2.influxdata.com/api/v2/write?org=Moonrider%20Pvt%20Ltd&bucket=Tractor_Data&precision=s";

const TOKEN = "BQ1heSXdZ6SVV-WlbYj1Su-p2qJbsMSNYtk5KEGE3kTno9LoGakSKfJGGhQsxNqGdsPMPpaFq5NtFpgMtT2I-w==";

const client = mqtt.connect(MQTT_BROKER,{
  username: "MR_TRACTOR",
  password: "#Lokesh000"
});

client.on("connect", () => {
  console.log("Connected to HiveMQ");
  client.subscribe(MQTT_TOPIC);
});

client.on("message", async (topic, message) => {

  const line = message.toString();

  console.log("Received:", line);

  try {

    await axios.post(INFLUX_URL, line, {
      headers:{
        "Authorization": `Token ${TOKEN}`,
        "Content-Type": "text/plain"
      }
    });

    console.log("Data written to InfluxDB");

  } catch(err) {

    console.log("InfluxDB error:", err.response?.data || err.message);

  }

});
