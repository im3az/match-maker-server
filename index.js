const express = require("express");
const app = express();
require("dotenv").config();
const cors = require("cors");
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.thriitw.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const allBiodataCollection = client
      .db("matchMaker")
      .collection("allBiodata");
    const userCollection = client.db("matchMaker").collection("users");

    // user related api

    app.post("/users", async (req, res) => {
      const user = req.body;

      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "User already exists", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // biodata related api
    app.put("/editBiodata", async (req, res) => {
      const biodata = req.body;

      const existingBiodata = await allBiodataCollection.findOne({
        email: biodata.email,
      });

      if (existingBiodata) {
        biodata.biodataId = existingBiodata.biodataId;
      } else {
        const lastBiodata = await allBiodataCollection
          .find()
          .sort({ biodataId: -1 })
          .limit(1)
          .toArray();

        biodata.biodataId =
          lastBiodata.length === 0 ? 1 : lastBiodata[0].biodataId + 1;
      }

      const filter = { email: biodata.email };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          age: parseInt(biodata.age),
          dateOfBirth: biodata.dateOfBirth,
          email: biodata.email,
          fathersName: biodata.fathersName,
          gender: biodata.gender,
          height: biodata.height,
          image: biodata.image,
          mobileNumber: biodata.mobileNumber,
          mothersName: biodata.mothersName,
          name: biodata.name,
          occupation: biodata.occupation,
          partnerAge: parseInt(biodata.partnerAge),
          partnerHeight: biodata.partnerHeight,
          partnerWeight: biodata.partnerWeight,
          permanentDivision: biodata.permanentDivision,
          presentDivision: biodata.presentDivision,
          religion: biodata.religion,
          weight: biodata.weight,
          biodataId: biodata.biodataId,
        },
      };
      const result = await allBiodataCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });

    app.get("/allBiodata", async (req, res) => {
      const result = await allBiodataCollection.find().toArray();
      res.send(result);
    });

    app.get("/userBiodata", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await allBiodataCollection.find(query).toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("MatchMaker site is running");
});

app.listen(port, () => {
  console.log(`MatchMaker is running on port: ${port}`);
});
