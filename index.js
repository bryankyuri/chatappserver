import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: [
      "http://localhost:5173",
      "https://chatapp-bryanq-projects.vercel.app",
      "https://chatapp-alpha-eight.vercel.app/"
    ],
    methods: ["GET", "POST"],
  },
});

// Initialize OpenAI
const openai = new OpenAI({
  // apiKey: process.env.OPENAI_API_KEY
  apiKey: "askjdhkasjdha8-ksajdhk-lsakdjla",
});

// Store active users and their chat sessions
const users = new Map();
const userSessions = new Map();

class ChatSession {
  constructor(userId, topic) {
    this.userId = userId;
    this.topic = topic;
    this.messages = [
      {
        role: "system",
        content: `You are a helpful AI assistant discussing the topic: ${topic}. Provide engaging and informative responses.`,
      },
    ];
  }

  async sendMessage(message) {
    this.messages.push({
      role: "user",
      content: message,
    });

    try {
      // Add artificial delay to simulate processing time (remove in production)
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: this.messages,
        temperature: 0.7,
        max_tokens: 1000,
      });

      const aiResponse = completion.choices[0].message.content;
      this.messages.push({
        role: "assistant",
        content: aiResponse,
      });

      return aiResponse;
    } catch (error) {
      console.error("OpenAI API Error:", error);
      return "Sorry, I encountered an error processing your request.";
    }
  }
}

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Handle user registration
  socket.on("register", (userId) => {
    users.set(userId, socket.id);
    if (!userSessions.has(userId)) {
      userSessions.set(userId, new Map()); // Map to store multiple topics for each user
    }
    socket.emit("registered", { userId });
  });

  // Handle new topic creation
  socket.on("create_topic", async ({ userId, topic }) => {
    const userTopics = userSessions.get(userId);
    if (userTopics) {
      const newSession = new ChatSession(userId, topic);
      userTopics.set(topic, newSession);
      socket.emit("topic_created", { topic });
    }
  });

  // Handle chat messages with AI
  socket.on("chat_message", async ({ userId, topic, message }) => {
    const userTopics = userSessions.get(userId);
    if (userTopics) {
      const session = userTopics.get(topic);
      if (session) {
        const aiResponse = await session.sendMessage(message);
        socket.emit("ai_response", {
          topic,
          message: aiResponse,
          timestamp: new Date().toISOString(),
        });
      }
    }
  });

  // Handle get user topics
  socket.on("get_topics", ({ userId }) => {
    const userTopics = userSessions.get(userId);
    if (userTopics) {
      const topics = Array.from(userTopics.keys());
      socket.emit("user_topics", { topics });
    }
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    let disconnectedUserId;
    for (const [userId, socketId] of users.entries()) {
      if (socketId === socket.id) {
        disconnectedUserId = userId;
        break;
      }
    }

    if (disconnectedUserId) {
      users.delete(disconnectedUserId);
      // We don't delete sessions so they persist between connections
    }
    console.log("User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
