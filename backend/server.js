import express from "express";
import dotenv from "dotenv";
import { connectDB } from "./Src/db/index.js";
import cors from "cors";
dotenv.config({ path: "./.env" });

const app = express();
const PORT = process.env.PORT 


app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors()); 


const startServer = async () => {
  try {
    await connectDB();
    console.log("\x1b[32m%s\x1b[0m", "✔ MongoDB Connected");

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("\x1b[31m%s\x1b[0m", "❌ Server failed to start", error);
    process.exit(1);
  }
};

startServer();