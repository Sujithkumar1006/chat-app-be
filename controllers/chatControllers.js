const Messages = require("../models/message");
const User = require("../models/users");

const getChatUsers = async (req, res) => {
  const { sub: loggedInUserId } = req?.auth?.payload;

  try {
    const chatUsers = await Messages.aggregate([
      {
        $match: {
          $or: [{ sender: loggedInUserId }, { recipient: loggedInUserId }],
        },
      },
      {
        $project: {
          content: 1,
          imageUrl: 1,
          timestamp: "$timestamp",
          isRead: 1,
          otherUser: {
            $cond: [
              { $eq: ["$sender", loggedInUserId] },
              "$recipient",
              "$sender",
            ],
          },
        },
      },
      {
        $sort: { timestamp: -1 },
      },
      {
        $group: {
          _id: "$otherUser",
          lastMessage: { $first: "$content" },
          lastImage: { $first: "$imageUrl" },
          isRead: { $first: "$isRead" },
          timestamp: { $first: "$timestamp" },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "auth0_id",
          as: "userDetails",
        },
      },
      {
        $unwind: "$userDetails",
      },
      {
        $project: {
          _id: 0,
          auth0_id: "$userDetails.auth0_id",
          name: "$userDetails.name",
          email: "$userDetails.email",
          picture: "$userDetails.picture",
          lastMessage: 1,
          lastImage: 1,
          isRead: 1,
          timestamp: 1,
        },
      },
      {
        $sort: { timestamp: -1 }, // sort conversations by recent
      },
    ]);

    res.status(200).json({ users: chatUsers });
  } catch (err) {
    console.error("Error fetching chat users with last message:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

const fetchMessages = async (req, res) => {
  const { sub: auth0_id } = req?.auth?.payload; // Logged-in user's Auth0 ID
  const otherUserId = req?.query?.sender_id; // Chat partner's Auth0 ID

  if (!auth0_id || !otherUserId) {
    return res.status(400).json({ message: "Missing user IDs" });
  }

  try {
    // console.log("userrrr", auth0_id, otherUserId);
    const messages = await Messages.find({
      $or: [
        { sender: auth0_id, recipient: otherUserId },
        { sender: otherUserId, recipient: auth0_id },
      ],
    }).sort({ timestamp: 1 });

    const userSettings = await User.findOne({ auth0_id: auth0_id });

    res
      .status(200)
      .json({ messages, settings: userSettings.autoDestructSettings });
  } catch (err) {
    console.error("Error in fetchMessages:", err);
    res.status(500).json({ message: "Error fetching messages" });
  }
};

const createMessage = async (body) => {
  const { reciever_id, message, time, imageUrl, sender_id } = body;
  // const { sub: auth0_id } = req?.auth?.payload;
  console.log("reqqq", body);
  try {
    const user = await User.findOne({ auth0_id: sender_id });
    const existingSetting = user.autoDestructSettings.find(
      (s) => s.recipientId === reciever_id
    );
    const newMessageObj = {
      sender: sender_id,
      recipient: reciever_id,
      content: message ?? "",
      imageUrl,
      isRead: false,
      timestamp: new Date(time),
      autoDeleteAt: existingSetting
        ? new Date(new Date(time).getTime() + existingSetting.ttl * 1000)
        : null,
    };
    const savedMessage = await Messages.create(newMessageObj);
    return savedMessage;
    // res.status(201).json(savedMessage);
  } catch (err) {
    console.error("Error saving message:", err);
    throw err;
    // res.status(500).json({ error: "Failed to create message" });
  }
};

const updateReadReciept = async (messageId) => {
  try {
    await Messages.findByIdAndUpdate(messageId, { isRead: true });
  } catch (err) {
    throw err;
  }
};

module.exports = {
  fetchMessages,
  createMessage,
  getChatUsers,
  updateReadReciept,
};
