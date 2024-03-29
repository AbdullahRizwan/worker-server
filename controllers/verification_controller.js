import { Verification } from "../models/verification.js";
import axios from "axios";

export const verify_email_in_db = async (email) => {
  const all = await Verification.find({ email: email });
  return all;
};

export class VerificationController {
  klean_api_request = async (email, depth = 0) => {
    var reqBody = {
      record: email,
    };
    reqBody = JSON.stringify(reqBody);
    const options = {
      headers: {
        api_key: process.env.KLEAN_API_KEY,
        "Content-Type": "application/json",
      },
    };

    return axios
      .post(
        "https://api.kleanmail.com/record_verification/api_record",
        reqBody,
        options
      )
      .then((response) => {
        
        const raw_data = response.data;
        const verification = new Verification({
          email: raw_data["record"],
          is_valid: raw_data["is_exist"] ? true : false,
          is_disposable: raw_data["is_disposable"]? true : false,
          verified_on: new Date(),
        });

        verification.save((err, doc) => {
          if (err){
            // console.log("Error during record insertion with klean: "+ email + '\n' + err.message);
          }
        
          
        });

        return verification;
      })
      .catch((err) => {
        // console.log(err.message);
        if (depth < 8) {
          return this.klean_api_request(email, depth + 1);
        }
        else {
          const verification = new Verification({
            email: email,
            is_valid: false,
            is_disposable: false,
            verified_on: new Date(),
          });
          verification.save((err, doc) => {
            if (err)
            console.log("Error during record insertion with klean: "+ email + '\n' + err.message);
          });
  
          return verification;
        }
      });
  };

  clearout_email_verification = async (email) => {
    var reqBody = {
      email: email,
    };
    reqBody = JSON.stringify(reqBody);
    const options = {
      headers: {
        Authorization: process.env.CLEAROUT_API_KEY, // Your API KEY
        "Content-Type": "application/json",
      },
    };
    return axios
      .post("https://api.clearout.io/v2/email_verify/instant", reqBody, options)
      .then((response) => {
        const raw_data = response.data;
        const verification = new Verification({
          email: email,
          is_valid: raw_data["data"]["status"] == "valid" || false,
          is_disposable: raw_data["data"]["desposible"] != "no",
          verified_on: new Date(),
        });

        verification.save((err, doc) => {
          // if (!err) console.log("success", "User added successfully!");
          // else console.log("Error during record insertion : " + err);
        });

        return verification;
      });
  };
}

const controller = new VerificationController();

export const verify_email_scheduled = async (email) => {
  const cached_queries = await verify_email_in_db(email);
  if (cached_queries.length > 0) {
    return Promise.resolve(cached_queries[0]);
  }

  

  let isResolved = false;
  let verificationStatus = null;
  
  controller.klean_api_request(email)
    .then((result) => {
      if (!isResolved) {
        isResolved = true;
        verificationStatus = result;
      }
    })
    .catch((err) => {
      // console.log(err.message);
    });
  await new Promise((r) => setTimeout(r, 5000));
  if (isResolved) {
    return verificationStatus;
  }
  controller.klean_api_request(email)
    .then((result) => {
      if (!isResolved) {
        isResolved = true;
        verificationStatus = result;
      }
    })
    .catch((err) => {
      // console.log(err.message);
    });
  await new Promise((r) => setTimeout(r, 5000));
  if (isResolved) {
    return verificationStatus;
  }
  return controller.clearout_email_verification(email)
    .then((result) => {
      if (!isResolved) {
        isResolved = true;
        verificationStatus = result;
        return result;
      }
    })
    .catch((err) => {
      // console.log(err.message);
    });
}; 