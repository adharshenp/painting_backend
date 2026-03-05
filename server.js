const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

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
  .catch((err) => console.log("MongoDB Error:", err));

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
  try {
    const artworks = await Artwork.find().sort({ createdAt: -1 });

    const baseUrl = `${req.protocol}://${req.get("host")}`;

    const images = artworks.map((art) => ({
      id: art._id,
      url: `${baseUrl}/uploads/${art.image}`,
      name: art.name,
    }));

    res.json({ images });
  } catch (error) {
    res.status(500).json({ message: "Error fetching images" });
  }
});

/* 📤 Upload Image (Admin Only) */
app.post("/upload", auth, upload.single("image"), async (req, res) => {
  try {
    const newArtwork = await Artwork.create({
      name: "Untitled",
      image: req.file.filename,
    });

    const baseUrl = `${req.protocol}://${req.get("host")}`;

    res.json({
      id: newArtwork._id,
      url: `${baseUrl}/uploads/${newArtwork.image}`,
      name: newArtwork.name,
    });
  } catch (error) {
    res.status(500).json({ message: "Upload failed" });
  }
});

/* ✏️ Edit Image Name */
app.put("/edit/:id", auth, async (req, res) => {
  try {
    const { name } = req.body;

    const updated = await Artwork.findByIdAndUpdate(
      req.params.id,
      { name },
      { new: true }
    );

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Update failed" });
  }
});

/* ❌ Delete Image */
app.delete("/delete/:id", auth, async (req, res) => {
  try {
    const artwork = await Artwork.findById(req.params.id);

    if (!artwork) return res.status(404).json({ message: "Not found" });

    fs.unlinkSync(`uploads/${artwork.image}`);

    await artwork.deleteOne();

    res.json({ message: "Deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Delete failed" });
  }
});

/* ==========================
   Start Server
========================== */
const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});