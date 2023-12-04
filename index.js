const express = require("express");
const app = express();
require("dotenv").config();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
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
    // await client.connect();

    const allBiodataCollection = client
      .db("matchMaker")
      .collection("allBiodata");
    const userCollection = client.db("matchMaker").collection("users");
    const reviewsCollection = client.db("matchMaker").collection("reviews");
    const premiumRequestsCollection = client
      .db("matchMaker")
      .collection("premiumRequest");

    // jwt related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "6h",
      });
      res.send({ token });
    });

    // middlewares
    const verifyToken = (req, res, next) => {
      // console.log("Inside verify token", req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "Unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "Unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
      // next();
    };

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "Forbidden access" });
      }
      next();
    };

    // user related api

    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "Forbidden access" });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

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

    app.patch(
      "/users/admin/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            role: "admin",
          },
        };

        const result = await userCollection.updateOne(filter, updateDoc);
        res.send(result);
      }
    );

    // premium related api

    app.get("/premiumCollection", async (req, res) => {
      const query = { role: "premium" };
      const result = await premiumRequestsCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/premiumRequests", verifyToken, verifyAdmin, async (req, res) => {
      const result = await premiumRequestsCollection.find().toArray();
      res.send(result);
    });

    app.get("/users/premium/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "Forbidden access" });
      }
      const query = { email: email };
      const user = await premiumRequestsCollection.findOne(query);
      let premium = false;
      if (user) {
        premium = user?.role === "premium";
      }
      res.send({ premium });
    });

    app.post("/premiumRequest", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await premiumRequestsCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "User already exists", insertedId: null });
      }
      const result = await premiumRequestsCollection.insertOne(user);
      res.send(result);
    });

    app.patch(
      "/users/premium/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            role: "premium",
          },
        };

        const result = await premiumRequestsCollection.updateOne(
          filter,
          updateDoc
        );
        res.send(result);
      }
    );

    app.patch(
      "/biodata/premium/:email",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const email = req.params.email;
        const filter = { email: email };
        const updateDoc = {
          $set: {
            status: "premium",
          },
        };

        const result = await allBiodataCollection.updateOne(filter, updateDoc);
        res.send(result);
      }
    );

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

    app.get("/premiumBiodata", async (req, res) => {
      const query = { status: "premium" };
      const result = await allBiodataCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/biodataDetails/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await allBiodataCollection.findOne(query);
      res.send(result);
    });

    app.get("/suggestions", async (req, res) => {
      const gender = req.query.gender;
      const query = { gender: gender };
      const result = await allBiodataCollection.find(query).toArray();
      res.send(result);
    });

    // reviews api
    app.get("/reviews", async (req, res) => {
      const result = await reviewsCollection.find().toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
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
