const axios = require("axios");
const { MongoClient } = require("mongodb");

require("dotenv").config();

const client = new MongoClient(process.env.DB_URI);
const ORD_URL = "https://ordinals.com";

const fetchInscriptions = async (offset) => {
  console.log(`Fethcing inscription list with offset: ${offset}...`);
  const res = await axios.get(`${ORD_URL}/inscriptions/${offset}`);
  const inscriptionIds = res.data.match(/<a href=\/inscription\/(.*?)>/gm)
  ///\/inscription\/(.*?)>/g
  //<a href=\/inscription\/(.*?)>/g
  //console.log()
  //console.log("inscriptionIds:", inscriptionIds)
  let inscriptionData = []

  for (let i = 0; i < inscriptionIds.length; i++) {
    const inscription = inscriptionIds[i].replace("<a href=/inscription/", "").replace(">", "")
    console.log("Fetching:", inscription)
    const response = await axios.get(`${ORD_URL}/inscription/${inscription}`)

    const data = [...response.data.matchAll(/<dt>(.*?)<\/dt>\s*<dd.*?>(.*?)<\/dd>/gm)]
        .map(x => { x[2] = x[2].replace(/<.*?>/gm, ''); return x })
        .reduce((a, b) => { return { ...a, [b[1]]: b[2] } }, {});

    data["number"] = Number(response.data.match(/<h1>Inscription (.*?)<\/h1>/)[1]);
    console.log("ins-data:", data)
    const date = new Date(data["timestamp"]);
    data["timestamp"] = date.getTime(); 
    
    inscriptionData.push({
      id: data["id"],
      number: data["number"],
      address: data["address"],
      output_value: Number(data["output value"]),
      sat: Number(data["sat"]),
      content_length: Number(data["content length"].replace(" bytes", "")),
      content_type: data["content type"],
      timestamp: Date.parse(data["timestamp"]),
      genesis_height: Number(data["genesis height"]),
      genesis_fee: Number(data["genesis fee"]),
      genesis_transaction: data["genesis transaction"],
      location: data["location"],
      output: data["output"],
      offset: Number(data["offset"]),
      timestamp: data["timestamp"]
    })
    console.log("inscriptionData:", inscriptionData[i])
  }
  return inscriptionData
};

const index = async () => {
  let offset = 100;

  while (true) {
    const data = await fetchInscriptions(offset);
    console.log(data)
    if (data.length == 0) {
      break;
    }
    offset += data.length;

    try {
      const database = client.db("ordinals");
      const inscriptions = database.collection("inscriptions");
      const result = await inscriptions.insertMany(data, { ordered: false });
    } catch (e) {
      if (e.name === "MongoBulkWriteError") {
        break;
      }
      throw e;
    }
  }

  await client.close();
  process.exit();
};

index();
