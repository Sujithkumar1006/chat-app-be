const mongoose = require("mongoose");

const autoDestructSchema = new mongoose.Schema(
  {
    recipientId: {
      type: String,
      required: true,
    },
    ttl: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    auth0_id: {
      type: String,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
    },
    name: String,
    picture: String,
    is_verified: {
      type: Boolean,
      default: false,
    },
    last_seen: {
      type: Date,
      default: Date.now,
    },
    autoDestructSettings: {
      type: [autoDestructSchema],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
