import mongoose from "mongoose";

const finderQuerySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  filename: {
    type: String,
    required: true,
    minlength: 3,
    maxlength: 50,
  },
  valid_count: {
    type: Number,
  },
  invalid_count: {
    type: Number,
  },
  timestamp: {
    type: Date,
    required: true,
  },
  firebase_key: {
    type: String,
  },
  emails: [
    {
      type: String,
      minlength: 5,
      maxlength: 50,
    },
  ],
});

export const FinderQuery = mongoose.model(
  "FinderQuery",
  finderQuerySchema
);
