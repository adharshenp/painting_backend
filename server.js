const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");

dotenv.config();

const Artwork = require("./models/Artwork");
const auth = require("./middleware/auth");

const app = express();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

/* ==========================
   MongoDB Connection
========================== */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.log(err));

/* ==========================
   Multer Config
========================== */
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

/* ==========================
   ROUTES
========================== */

/* 🔐 Admin Login */
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (
    username === process.env.ADMIN_USERNAME &&
    password === process.env.ADMIN_PASSWORD
  ) {
    const token = jwt.sign({ admin: true }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    return res.json({ token });
  }

  res.status(401).json({ message: "Invalid credentials" });
});

/* 📥 Get All Images */
app.get("/uploads", async (req, res) => {
  const artworks = await Artwork.find().sort({ createdAt: -1 });

  const images = artworks.map((art) => ({
    id: art._id,
    url: `http://localhost:5000/uploads/${art.image}`,
    name: art.name,
  }));

  res.json({ images });
});

/* 📤 Upload Image (Admin Only) */
app.post("/upload", auth, upload.single("image"), async (req, res) => {
  const newArtwork = await Artwork.create({
    name: "Untitled",
    image: req.file.filename,
  });

  res.json({
    id: newArtwork._id,
    url: `http://localhost:5000/uploads/${newArtwork.image}`,
    name: newArtwork.name,
  });
});

/* ✏️ Edit Image Name */
app.put("/edit/:id", auth, async (req, res) => {
  const { name } = req.body;

  const updated = await Artwork.findByIdAndUpdate(
    req.params.id,
    { name },
    { new: true }
  );

  res.json(updated);
});

/* ❌ Delete Image */
app.delete("/delete/:id", auth, async (req, res) => {
  const artwork = await Artwork.findById(req.params.id);

  if (!artwork) return res.status(404).json({ message: "Not found" });

  const fs = require("fs");
  fs.unlinkSync(`uploads/${artwork.image}`);

  await artwork.deleteOne();

  res.json({ message: "Deleted successfully" });
});

/* ==========================
   Start Server
========================== */
app.listen(process.env.PORT, () =>
  console.log(`🚀 Server running on port ${process.env.PORT}`)
);