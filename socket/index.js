const express = require("express");
const { Server } = require("socket.io");
const http = require("http");
const UserModel = require("../models/userModel");
const ConversationModel = require("../models/Conversation");
const messageModel = require("../models/messageModel");
const app = express();
const getUserByToken = require("../utils/getUserByToken");
const getConversation = require("../utils/getConversation");

// socket connect
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    credentials: true,
  },
});

const onlineUsers = new Set();

try {
  io.on("connection", async (socket) => {
    const token = socket.handshake.auth.token;
  
    const user = await getUserByToken(token);
  
    //   join room
    socket.join(user?._id?.toString());
    onlineUsers?.add(user?._id?.toString());
  
    io.emit("onlineUser", Array.from(onlineUsers));
  
    socket.on("messagePage", async (userId) => {
      const userDetails = await UserModel.findById(userId).select("-password");
  
      const data = {
        _id: userDetails?._id,
        name: userDetails?.name,
        email: userDetails?.email,
        profilePic: userDetails?.profilePic,
        online: onlineUsers?.has(userId),
      };
  
      socket.emit("messageUser", data);
  
      // old messages
      const getConvMessages = await ConversationModel.findOne({
        $or: [
          { sender: user?._id, receiver: userId },
          { sender: userId, receiver: user?._id },
        ],
      })
        .populate("messages")
        .sort({ updatedAt: -1 });
      socket.emit("message", getConvMessages?.messages || []);
    });
  
    //    new message
    socket.on("newMessage", async (data) => {
      let conversation = await ConversationModel.findOne({
        $or: [
          { sender: data?.sender, receiver: data?.receiver },
          { sender: data?.receiver, receiver: data?.sender },
        ],
      });
  
      if (!conversation) {
        conversation = await ConversationModel.create({
          sender: data?.sender,
          receiver: data?.receiver,
        });
      }
  
      const message = await messageModel?.create({
        text: data?.text,
        imageUrl: data?.imageUrl,
        videoUrl: data?.videoUrl,
        msgByUser: data?.msgByUserId,
      });
  
      if (message) {
        await ConversationModel.updateOne(
          { _id: conversation?._id },
          {
            $push: { messages: message?._id },
          }
        );
  
        const getUpdatedConversation = await ConversationModel.findOne({
          $or: [
            { sender: data?.sender, receiver: data?.receiver },
            { sender: data?.receiver, receiver: data?.sender },
          ],
        })
          .populate("messages")
          .sort({ updatedAt: -1 });
  
        // send new message
        io.to(data?.sender).emit(
          "message",
          getUpdatedConversation?.messages || []
        );
  
        io.to(data?.receiver).emit(
          "message",
          getUpdatedConversation?.messages || []
        );
  
        // send conversation to frontend
        const sendConv = await getConversation(data?.sender);
        const receiverConv = await getConversation(data?.receiver);
  
        io.to(data?.sender).emit("conversation", sendConv || []);
        io.to(data?.receiver).emit("conversation", receiverConv || []);
      }
    });
  
    // side bar
    socket.on("sidebar", async (userId) => {
      const conversation = await getConversation(userId);
      socket.emit("conversation", conversation);
    });
  
    // seen messages
    socket.on("seen", async (msgByUser) => {
      
      let conversation = await ConversationModel.findOne({
        $or: [
          { sender: user?._id, receiver: msgByUser },
          { sender: msgByUser, receiver: user?._id },
        ],
      });
    
      if (conversation) {
        const getMessages = conversation?.messages || [];
    
        await messageModel.updateMany(
          {
            _id: { $in: getMessages },
            msgByUser,
          },
          {
            $set: { seen: true },
          }
        );
    
        const sendConv = await getConversation(user?._id?.toString());
        const receiverConv = await getConversation(msgByUser);
    
        io.to(user?._id?.toString()).emit("conversation", sendConv || []);
        io.to(msgByUser).emit("conversation", receiverConv || []);
      } else {
        console.error("Conversation not found");
      }
    });  
  
    socket.on("disconnect", () => {
      onlineUsers.delete(user?._id?.toString());
    });
  
    socket.on("callUser", (data) => {
      console.log("server call received")
      io.to(data.toUser._id).emit("callUser", { signal: data.signalData, fromUser: data.fromUser });
    });
  
    socket.on("answerCall", (data) => {
      if (data.toUser) {
        io.to(data.toUser._id).emit("callAccepted", data.signal);
      }
    });
  
    socket.on("iceCandidate", (data) => {
      io.to(data.toUser._id).emit("iceCandidate", data.candidate);
    });
  });
} catch (error) {
  console.log(error);
}



module.exports = {
  app,
  server,
};
