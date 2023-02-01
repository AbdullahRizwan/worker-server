import mongoose from "mongoose";


const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    minlength: 3,
    maxlength: 50,
  },
  lastName: {
    type: String,
    required: true,
    minlength: 3,
    maxlength: 50,
  },
  username: {
    type: String,
    unique: true,
    required: true,
    minlength: 3,
    maxlength: 50,
  },
  is_admin: {
    type: Boolean,
    required: true,
  },
  credits: {
    type: Number,
    required: true,
    default: 0,
  },
  email: {
    type: String,
    required: true,
  },
});

export const User = mongoose.model("User", userSchema);