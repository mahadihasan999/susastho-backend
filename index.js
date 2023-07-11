const express = require("express");
const { MongoClient } = require("mongodb");
const cors = require("cors");
const admin = require("firebase-admin");
const ObjectId = require("mongodb").ObjectId;
const { json } = require("express");
const fileUpload = require("express-fileupload");
require("dotenv").config();
const { v4: uuidv4 } = require("uuid");
const app = express();
const port = process.env.PORT || 5000;

app.use(express.urlencoded({ extended: true }));

// const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
// var serviceAccount = require("./maliha-tabassum-firebase-adminsdk.json");

// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
// });

app.use(cors());
app.use(express.json());
app.use(fileUpload());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.h7wek.mongodb.net/?retryWrites=true&w=majority
`;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

//verify token
async function verifyToken(req, res, next) {
  if (req.headers?.authorization?.startsWith("Bearer ")) {
    const token = req.headers.authorization.split(" ")[1];

    try {
      const decodedUser = await admin.auth().verifyIdToken(token);
      req.decodedEmail = decodedUser.email;
    } catch {}
  }
  next();
}

async function run() {
  try {
    await client.connect();
    const database = client.db("surokkha-health");
    const blogsCollection = database.collection("blogs");
    const dashboardCollection = database.collection("dashboard");
    const usersCollection = database.collection("users");

    //Get Blogs API from here
    app.get("/blogs", async (req, res) => {
      const cursor = blogsCollection.find().sort({ _id: -1 });
      const page = req.query.page;
      const size = parseInt(req.query.size);
      let blogs;
      const count = await cursor.count();
      if (page) {
        blogs = await cursor
          .skip(page * size)
          .limit(size)
          .toArray();
      } else {
        blogs = await cursor.toArray();
      }

      res.send({
        count,
        blogs,
      });
    });

    app.post("/blogs", async (req, res) => {
      const post = req.body;
      const blogs = await blogsCollection.insertOne(post);
      res.send(blogs);
    });
    app.post("/dashboard", async (req, res) => {
      const post = req.body;
      const dashboard = await dashboardCollection.insertOne(post);
      res.send(dashboard);
    });

    app.get("/dashboard", async (req, res) => {
      const cursor = dashboardCollection.find().sort({ _id: -1 });
      const dashboard = await cursor.toArray();
      res.send(dashboard);
    });

    app.get("/blogs/:id([0-9a-fA-F]{24})", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const blogs = await blogsCollection.findOne(query);
      // console.log('load poem with id: ', id);
      res.send(blogs);
    });
    //update API
    app.put("/blogs/:id", async (req, res) => {
      const id = req.params.title;
      console.log(id);
      const updateProducts = req.body;
      const filter = { _id: ObjectId(id) };
      const options = { upsert: true };
      const handleProduct = {
        $set: {
          title: updateProducts.title,
          excerpt: updateProducts.excerpt,
          image: updateProducts.image,
        },
      };
      const result = await blogsCollection.updateOne(
        filter,
        handleProduct,
        options
      );
      console.log("updating", id);
      res.json(result);
    });

    // DELETE API
    app.delete("/blogs/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await blogsCollection.deleteOne(query);
      console.log("deleting poem with id ", result);
      res.json(result);
    });

    //useremail

    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let isAdmin = false;
      if (user?.role === "admin") {
        isAdmin = true;
      }
      res.json({ admin: isAdmin });
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      console.log(result);
      res.json(result);
    });

    app.put("/users/:id", async (req, res) => {
      const { id } = req.params.id;
      console.log(id);
      const updatedUser = req.body;
      const filter = { _id: ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          name: updatedUser.name,
          email: updatedUser.email,
          city: updatedUser.city,
          address: updatedUser.address,
          phone: updatedUser.phone,
        },
      };
      const result = await usersCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });

    app.put("/users/admin", verifyToken, async (req, res) => {
      console.log("admin hitted");
      const user = req.body;
      console.log("request email", user);
      const requester = req.decodedEmail;
      console.log("Admin Email:", requester);
      if (requester) {
        const requesterAccount = await usersCollection.findOne({
          email: requester,
        });
        if (requesterAccount.role === "admin") {
          const filter = { email: user.email };
          const updateDoc = { $set: { role: "admin" } };
          console.log(updateDoc);
          const result = await usersCollection.updateOne(filter, updateDoc);
          res.json(result);
          console.log(result);
        }
      } else {
        res
          .status(403)
          .json({ message: "you do not have access to make admin" });
      }
    });

    //sslcommerce
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("surokkha helath server site is running");
});

app.listen(port, () => {
  console.log("Server running at port", port);
});
