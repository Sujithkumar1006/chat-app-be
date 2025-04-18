const express = require("express");
const {
  createMessage,
  fetchMessages,
  getChatUsers,
} = require("../controllers/chatControllers");

const router = express.Router();

router.post("/", createMessage);
router.get("/", fetchMessages);
router.get("/all-chats", getChatUsers);

module.exports = router;
