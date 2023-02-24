import { File } from "./models/file.js";
import axios from 'axios';

import amqp from "amqplib/callback_api.js";

import { config } from "dotenv";
import {connectDB} from './config/db.js';


import {
    VerificationController,
    verify_email_in_db,
    verify_email_scheduled,
  } from "./controllers/verification_controller.js";

import {
    addVerificationToUser,
    removeInProgress,
  } from "./controllers/user_controller.js";
  

config({path:'./config/.env'})
connectDB();


const controller = new VerificationController();

const Methods = {
  KLEAN: 0,
  CLEAROUT: 1,
  BOTH: 2,
}

const verify_email = async (email, method) => {
    const cached_queries = await verify_email_in_db(email);
    if (cached_queries.length > 0) {
      return Promise.resolve(cached_queries[0]);
    }
    // return controller.klean_api_request(email);
    console.log("method" + '' + method)
    if (method == Methods.KLEAN) {
      return controller.klean_api_request(email);
    }
    if (method == Methods.CLEAROUT) {
      return controller.clearout_email_verification(email);
    }
    if (method == Methods.BOTH) {
      return verify_email_scheduled(email)      
    }
};



amqp.connect('amqp://localhost', (err, conn) => {
    if (err) {
        console.error(err);
    }

    conn.createChannel((err, channel) => {
      const queue = 'verify_email_queue';
  
      channel.assertQueue(queue, { durable: false });
  
      console.log(`[*] Waiting for messages in ${queue}. To exit press CTRL+C`);
  
      channel.consume(queue, (message) => {
        console.log(`[-->] Received ${message.content}`);
        const rec_body = JSON.parse(message.content);
        console.log(rec_body);
        console.log(`[x] Received email: ${rec_body.emails}`);
        const method = rec_body.method;
        
        Promise.all(rec_body.emails.map((email) => verify_email(email, method))).then(
            (results) => {
              const file = new File({
                filename: rec_body.filename,
                user_id: rec_body.username,
                date: rec_body.current_date,
                verifications: results,
              });
              file.save();
              console.log(results)
              const valid_count = results.filter((result) => result.is_valid).length;
              const invalid_count = results.filter((result) => !result.is_valid).length;
              addVerificationToUser(
                rec_body.query_id,
                rec_body.emails,
                valid_count,
                invalid_count
              ).then((_) => {
                removeInProgress(rec_body.query_id);
                console.log(rec_body.firebase_key);
                const url = `https://everify-326212-default-rtdb.asia-southeast1.firebasedatabase.app/${rec_body.firebase_key}.json`;
                axios.delete(url);
              });
            }
          );
      }, { noAck: true });
    });
  });