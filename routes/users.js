const express = require("express");
const {
  allUsers,
  syncUser,
  updateMessageSettings,
} = require("../controllers/usersControllers");

const router = express.Router();

router.post("/syncUser", syncUser);
router.post("/message-settings", updateMessageSettings);
router.get("/", allUsers);

module.exports = router;
