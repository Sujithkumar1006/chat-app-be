const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const database = require("./config/database");
const userRoutes = require("./routes/users");
const messageRoutes = require("./routes/chats");
const chatControllers = require("./controllers/chatControllers");
const { v4: uuidv4 } = require("uuid");

const { auth } = require("express-oauth2-jwt-bearer");

const jwtCheck = auth({
  audience: "https://dev-cdsfu1xs67k0fh7b.us.auth0.com/api/v2/",
  issuerBaseURL: "https://dev-cdsfu1xs67k0fh7b.us.auth0.com/",
  tokenSigningAlg: "RS256",
});

const allowedOrigins = ["http://localhost:3000"];

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
    origin: "http://localhost:3000",
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
  console.log("User connected", socket);

  socket.on("register", (userId) => {
    users[userId] = socket.id;
    io.emit("online_users", Object.keys(users));
    console.log(`${userId} registered with socket ID ${socket.id}`);
  });

  //   {
  //     "_id": "67fe769c6d797559d29d55d9",
  //     "sender": "auth0|67c60712c9af2f9686929a2a",
  //     "recipient": "google-oauth2|114693529677916280088",
  //     "content": "Hi, Kya",
  //     "imageUrl": null,
  //     "isRead": false,
  //     "autoDeleteAt": null,
  //     "timestamp": "2025-04-11T14:51:16.000Z",
  //     "createdAt": "2025-04-15T15:09:16.019Z",
  //     "updatedAt": "2025-04-15T15:09:16.019Z",
  //     "__v": 0
  // }

  socket.on("send_message", async (req) => {
    //Save Message to DB
    const message = await chatControllers.createMessage(req);
    const targetSocket = users[req.reciever_id];
    if (targetSocket) {
      io.to(targetSocket).emit("receive_message", message); // Sending to Reciever
    }
    io.to(users[req.sender_id]).emit("receive_message", message); // Sending to Sender
  });

  socket.on("read_message", async ({ messageId, senderId }) => {
    console.log("read_message", messageId, senderId);
    const targetSocket = users[senderId];
    await chatControllers.updateReadReciept(messageId);
    if (targetSocket) {
      io.to(targetSocket)?.emit("message_read", { messageId });
    }
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
