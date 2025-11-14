import express from "express";
import multer from "multer";
import cors from "cors";
import dotenv from "dotenv";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import mongoose from "mongoose";
import jwt from "jsonwebtoken"; // ✅ Add this

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

// ☁️ Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

// ⚡ MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ Connected to MongoDB Atlas"))
  .catch((err) => console.error("❌ MongoDB connection failed:", err));

// 🖼️ Image Schema & Model
const imageSchema = new mongoose.Schema({
  name: { type: String, default: "Untitled" },
  url: { type: String, required: true },
  public_id: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
});
const Image = mongoose.model("Image", imageSchema);

// 🗂️ Multer Setup
const upload = multer({ dest: "uploads/" });

// 🔑 Admin Login Route
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (
    username === process.env.ADMIN_USER &&
    password === process.env.ADMIN_PASS
  ) {
    const token = jwt.sign({ role: "admin" }, process.env.JWT_SECRET, {
      expiresIn: "2h",
    });
    return res.json({ message: "✅ Login successful", token });
  } else {
    return res.status(401).json({ error: "Invalid admin credentials" });
  }
});

// 🧠 Verify Admin Middleware
function verifyAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader)
    return res.status(401).json({ error: "No token provided" });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "admin") {
      return res.status(403).json({ error: "Access denied" });
    }
    next();
  } catch (err) {
    return res.status(403).json({ error: "Invalid or expired token" });
  }
}

// 📤 Upload Image
app.post("/upload", verifyAdmin, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "artist_portfolio",
    });
    fs.unlink(req.file.path, () => {});

    const newImage = await Image.create({
      name: req.body.name || "Untitled",
      url: result.secure_url,
      public_id: result.public_id,
    });

    res.status(201).json({
      message: "✅ Image uploaded successfully",
      id: newImage._id,
      name: newImage.name,
      url: newImage.url,
      public_id: newImage.public_id,
    });
  } catch (error) {
    console.error("❌ Upload failed:", error);
    res.status(500).json({ error: "Image upload failed" });
  }
});

// 📥 Fetch All Images
app.get("/uploads", async (req, res) => {
  const images = await Image.find().sort({ uploadedAt: -1 });
  res.json({
    images: images.map((img) => ({
      id: img._id,
      name: img.name,
      url: img.url,
      public_id: img.public_id,
    })),
  });
});

// ✏️ Edit
app.put("/edit/:id", verifyAdmin, async (req, res) => {
  const updated = await Image.findByIdAndUpdate(
    req.params.id,
    { name: req.body.name },
    { new: true }
  );
  res.json({ message: "✅ Name updated", image: updated });
});

// ❌ Delete
app.delete("/delete/:id", verifyAdmin, async (req, res) => {
  const img = await Image.findById(req.params.id);
  if (!img) return res.status(404).json({ error: "Image not found" });

  await cloudinary.uploader.destroy(img.public_id);
  await Image.findByIdAndDelete(req.params.id);
  res.json({ message: "✅ Image deleted" });
});

app.get("/", (req, res) => res.send("🎨 Backend running!"));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
