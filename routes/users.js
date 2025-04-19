const express = require("express");
const { allUsers, syncUser } = require("../controllers/usersControllers");

const router = express.Router();

router.post("/syncUser", syncUser);
router.get("/", allUsers);

module.exports = router;
