import express from "express";
import dotenv from "dotenv";

dotenv.config({ path: "./.env" });

const app = express();
const PORT = process.env.PORT || 5000;

app.get("/", (req, res) => {
  res.send("hello world");
});

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
