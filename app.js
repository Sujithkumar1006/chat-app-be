const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const database = require("./config/database");
const userRoutes = require("./routes/users");
const messageRoutes = require("./routes/chats");
const chatControllers = require("./controllers/chatControllers");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const Messages = require("./models/message");

const { auth } = require("express-oauth2-jwt-bearer");
require("dotenv").config({ path: `./.env.${process.env.NODE_ENV}` });

const jwtCheck = auth({
  audience: process.env.AUTH0_AUDIENCE,
  issuerBaseURL: process.env.ISSUER_BASE_URL,
  tokenSigningAlg: process.env.TOKEN_SIGNATURE,
});

const allowedOrigins = [process.env.REACT_APP];

const corsOptions = {
  origin: function (origin, callback) {
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
};

const app = express();
database();
app.use(cors(corsOptions));
app.use(bodyParser.json());

//Auth0 Middleware for all routes
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use(jwtCheck);

app.use("/api/user", userRoutes);
app.use("/api/messages", messageRoutes);

app.get("/", (req, res) => {
  res.send("Chat application started !!");
});

const server = app.listen(3001, () => {
  console.log("Chat application listening to port 3001");
});

const io = require("socket.io")(server, {
  pingTimeout: 60000,
  cors: {
    origin: process.env.REACT_APP,
    // credentials: true,
  },
});
const users = {};

io.use((socket, next) => {
  // const userId = socket.handshake.auth.userId;
  // if (!userId) {
  //   return next(new Error("invalid username"));
  // }
  // socket.userId = userId;
  next();
});

io.on("connection", (socket) => {
  socket.on("register", (userId) => {
    users[userId] = socket.id;
    io.emit("online_users", Object.keys(users));
    console.log(`${userId} registered with socket ID ${socket.id}`);
  });

  socket.on("send_message", async (req) => {
    const message = await chatControllers.createMessage(req);
    const targetSocket = users[req.reciever_id];
    if (targetSocket) {
      io.to(targetSocket).emit("receive_message", message); // Sending to Reciever
    }
    io.to(users[req.sender_id]).emit("receive_message", message); // Sending to Sender
  });

  socket.on("read_message", async ({ messageId, senderId, recieverId }) => {
    console.log("read_message", messageId, senderId);
    const targetSocket = users[senderId];
    await chatControllers.updateReadReciept(messageId);
    if (targetSocket) {
      io.to(targetSocket)?.emit("message_read", { messageId });
      io.to(users[recieverId])?.emit("message_read", { messageId });
    }
  });

  socket.on("send_image", async ({ imageBuffer, fileName, ...rest }) => {
    const newFileName = uuidv4() + fileName;
    const filePath = path.join(__dirname, "uploads", newFileName);
    fs.writeFile(filePath, imageBuffer, (err) => {
      if (err) {
        console.error("File save error:", err);
        return;
      }
      console.log("Image saved:", filePath);
    });
    console.log("Image saved:", filePath);
    const imageUrl = `http://localhost:3001/uploads/${newFileName}`;
    // const { reciever_id, message, time, imageUrl, sender_id } = body;
    const message = await chatControllers.createMessage({ ...rest, imageUrl });
    io.to(users[rest.sender_id]).emit("receive_image", message);
    io.to(users[rest.reciever_id]).emit("receive_image", message);
  });

  socket.on("disconnect", () => {
    for (const userId in users) {
      if (users[userId] === socket.id) {
        delete users[userId];
        break;
      }
    }
    io.emit("online_users", Object.keys(users));
  });
});

const deleteExpiredMessages = async () => {
  try {
    const now = new Date();
    const expiredMessages = await Messages.find({
      autoDeleteAt: { $ne: null, $lte: now },
      isDeleted: false,
    });

    if (expiredMessages.length > 0) {
      const messageIds = expiredMessages.map((msg) => msg._id);
      const recipients = expiredMessages.map((msg) => msg.recipient);
      const senders = expiredMessages.map((msg) => msg.sender);

      await Messages.updateMany(
        { _id: { $in: messageIds } },
        { $set: { isDeleted: true } }
      );

      console.log(`Auto-deleted ${messageIds.length} messages`);

      messageIds.forEach((id, index) => {
        const recipientSocket = users[recipients[index]];
        const senderSocket = users[senders[index]];

        if (recipientSocket) {
          io.to(recipientSocket).emit("message_deleted", { messageId: id });
        }
        if (senderSocket) {
          io.to(senderSocket).emit("message_deleted", { messageId: id });
        }
      });
    }
  } catch (err) {
    console.error("Error auto-deleting messages:", err);
  }
};

setInterval(deleteExpiredMessages, 60 * 1000);
