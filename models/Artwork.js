const mongoose = require("mongoose");

const artworkSchema = new mongoose.Schema({
  name: { type: String, default: "Untitled" },
  image: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Artwork", artworkSchema);