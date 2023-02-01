import mongoose from "mongoose";
import { Verification } from "./verification.js";

const fileSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  user_id: { type: String, required: true },
  date: { type: Date, default: Date.now },
  verifications: [Verification.schema],
});
export const File = mongoose.model("File", fileSchema);
