import { File } from "./models/file.js";
import axios from "axios";

import amqp from "amqplib/callback_api.js";

import { config } from "dotenv";
import { connectDB } from "./config/db.js";

import {
  VerificationController,
  verify_email_in_db,
  verify_email_scheduled,
} from "./controllers/verification_controller.js";

import {
  addVerificationToUser,
  removeInProgress,
} from "./controllers/user_controller.js";

import { generate_emails } from "./controllers/business_verification.js";
import {
  addFinderResultsToUser,
  removeInProgressFinder,
} from "./controllers/user_finder_controller.js";

config({ path: "./config/.env" });
connectDB();

const controller = new VerificationController();

const Methods = {
  KLEAN: 0,
  CLEAROUT: 1,
  BOTH: 2,
};

const verify_email = async (email, method) => {
  const cached_queries = await verify_email_in_db(email);
  if (cached_queries.length > 0) {
    return Promise.resolve(cached_queries[0]);
  }
  // return controller.klean_api_request(email);
  if (method == Methods.KLEAN) {
    return controller.klean_api_request(email);
  }
  if (method == Methods.CLEAROUT) {
    return controller.clearout_email_verification(email);
  }
  if (method == Methods.BOTH) {
    return verify_email_scheduled(email);
  }
};

function get(object, key, default_value) {
  var result = object[key];
  return typeof result !== "undefined" ? result : default_value;
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const verify_business = async (rec_body) => {
  var emails = rec_body.emails
    .map((email) =>
      generate_emails(
        get(email, "firstname", ""),
        get(email, "midname", ""),
        get(email, "lastname", ""),
        get(email, "domain", "")
      )
    )
    .flat();

  const verify_email_with_retry = async (email, method, retryCount = 0) => {
    try {
      await delay(2000); // 2-second delay
      return await verify_email(email, method);
    } catch (error) {
      if (error.response && error.response.status === 429 && retryCount < 3) {
        const retryDelay = Math.pow(2, retryCount) * 1000; // Backoff exponentially
        await delay(retryDelay);
        return await verify_email_with_retry(email, method, retryCount + 1);
      }
      throw error;
    }
  };

  // Custom function to wrap verify_email calls with a delay and retry
  const verify_email_with_delay_and_retry = async (email, method) => {
    return verify_email_with_retry(email, method);
  };

  const batchSize = 50;
  const totalEmails = emails.length;
  var results = [];
  for (let i = 0; i < totalEmails; i += batchSize) {
    const batchEmails = emails.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batchEmails.map((email) =>
        verify_email_with_delay_and_retry(email, Methods.CLEAROUT)
      )
    );
    results = results.concat(batchResults);
    // Process batch results here...
    // For example, you can save the results to the database or perform any other operations.

    // Check if there are more emails to process and add a 30-second delay if needed
    if (i + batchSize < totalEmails) {
      await delay(10000); // 10-second delay
    }
    console.log("Batch processed", i + batchSize, "emails");
  }

  // All batches processed, continue with the rest of the code...

  // Save the final file and other operations as before
  const file = new File({
    filename: rec_body.filename,
    user_id: rec_body.username,
    date: rec_body.current_date,
    verifications: results,
  });
  file.save();
  const valid_count = results.filter((result) => result.is_valid).length;
  const invalid_count = results.filter((result) => !result.is_valid).length;
  console.log(rec_body.query_id, emails, valid_count, invalid_count);
  addFinderResultsToUser(
    rec_body.query_id,
    emails,
    valid_count,
    invalid_count
  ).then((_) => {
    removeInProgressFinder(rec_body.query_id);
    const url = `https://everify-326212-default-rtdb.asia-southeast1.firebasedatabase.app/${rec_body.firebase_key}.json`;
    axios.delete(url);
  });
};

try {
  amqp.connect("amqp://localhost", (err, conn) => {
    try {
      if (err) {
        console.error(err.message);
        return;
      }
      conn.on('error', function(e){
        console.log("Error", e.message);
      })

      conn.createChannel((err, channel) => {
        if (err) {
          console.error(err.message);
        }
        const queue = "verify_email_queue";

        
        channel.assertQueue(queue, { durable: false });

        channel.consume(
          queue,
          (message) => {
            if (message == null) {
              return;
            }
            console.log("RECEIVED BUSINESS");

            const rec_body = JSON.parse(message.content);

            if (rec_body.type == "find_business") {
              verify_business(rec_body);
              return;
            }

            const method = rec_body.method;
            try {
              verify_file(rec_body, method);
            } catch (err) {
              // console.log(err.message);
            }
          },
          { noAck: true }
        );
      });
    } catch (err) {
      console.error(err.message);
    }
  });
} catch (err) {
  console.log("Error occured but server is runing", err.message);
}

function verify_file(rec_body, method) {
  Promise.all(rec_body.emails.map((email) => verify_email(email, method)))
    .then((results) => {
      const file = new File({
        filename: rec_body.filename,
        user_id: rec_body.username,
        date: rec_body.current_date,
        verifications: results,
      });
      file.save();
      const valid_count = results.filter((result) => result.is_valid).length;
      const invalid_count = results.filter((result) => !result.is_valid).length;
      addVerificationToUser(
        rec_body.query_id,
        rec_body.emails,
        valid_count,
        invalid_count
      ).then((_) => {
        removeInProgress(rec_body.query_id);
        const url = `https://everify-326212-default-rtdb.asia-southeast1.firebasedatabase.app/${rec_body.firebase_key}.json`;
        axios.delete(url);
      });
    })
    .catch((err) => {});
}
