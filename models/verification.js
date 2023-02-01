// TODO
/**
 * email address
 * verified on
 * verification status
 * desposible status
 */
import mongoose from "mongoose";

const verificationSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    minlength: 5,
    maxlength: 100,
  },
  is_valid: {
    type: Boolean,
    required: true,
  },
  verified_on: {
    type: Date,
    required: true,
  },
  is_disposable: {
    type: Boolean,
    required: true,
  },
});

export const Verification = mongoose.model('Verficiation', verificationSchema);
