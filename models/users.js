const mongoose = require("mongoose");

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
    preferences: {
      autoDeleteTimer: {
        type: Number,
        default: 60,
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
