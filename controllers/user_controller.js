import { User } from "../models/user.js";
import { VerificationQuery } from "../models/verification_query.js";
import { Verification } from "../models/verification.js";
import mongoose from "mongoose";

const userSignup = async (
  firstname,
  lastname,
  fullname,
  is_admin,
  email,
  credits
) => {
  const user = new User({
    firstName: firstname,
    lastName: lastname,
    username: fullname,
    is_admin: is_admin,
    credits: credits,
    email: email,
  });

  const result = await user.save();
  if (!result) return false;
  return true;
};


const createQuery = async (username, filename, timestamp, firebase_key) => {
  const user = await User.findOne({
    username: username,
  });
  if (!user) return false;

  const query = new VerificationQuery({
    user: user._id,
    filename: filename,
    timestamp: timestamp,
    firebase_key: firebase_key,
  });
  await query.save();
  return query._id;
};


const addVerificationToUser = async (
  query_id,
  emails,
  valid_count,
  invalid_count,
) => {
  // const verificationQuery = new VerificationQuery({
  //   user: user._id,
  //   filename: filename,
  //   valid_count: valid_count,
  //   invalid_count: invalid_count,
  //   timestamp: timestamp,
  //   emails: emails,
  // });

  await VerificationQuery.findOneAndUpdate(
    { _id:  mongoose.Types.ObjectId(query_id) },
    {
      $set: {
        emails: emails,
        valid_count: valid_count,
        invalid_count: invalid_count,
      },
    },
  );
  return true;
};

const removeInProgress = async (query_id) => { 
  await VerificationQuery.findOneAndUpdate(
    { _id:  mongoose.Types.ObjectId(query_id) },
    {
      $set: {
        firebase_key: null,
      },
    },
  );
  return true;
};

const getUserQuery = async(username, filename, timestamp) => {
  const user = await User.findOne({
    username: username,
  });
  if (!user) return null;

  const query = await VerificationQuery.findOne({
    user: user._id,
    filename: filename,
    timestamp: timestamp,
  });

  return query;
}

const getUserQueries = async (username) => {
  const user = await User.findOne({
    username: username,
  });
  if (!user) {
    return [];
  }

  const queries = await VerificationQuery.find({
    user: user._id,
  }).sort({ timestamp: -1 });
  return queries;
};

const getUserQueriesPagination = async (username, page) => {
  const PAGE_SIZE = 5;
  const user = await User.findOne({
    username: username,
  });
  if (!user) {
    return [];
  }
  const queries = await VerificationQuery.find({
    user: user._id,
  })
    .skip((page - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .sort({ timestamp: -1 });
  
  const page_count = (await VerificationQuery.countDocuments({
    user: user._id,
  }) - 1) / PAGE_SIZE;

  return {
    queries: queries,
    page_count: page_count,
  }
};

const getEmailsByFileID = async (username, id, filename) => {
  const user = await User.findOne({
    username: username,
  });
  if (!user) return [];

  const query = await VerificationQuery.findOne({
    user: user._id,
    date: id,
    filename: filename,
  });
  return query.emails;
};

const getUsersCount = async () => {
  const count = await User.countDocuments();
  return count;
};

// get all user in pagination with 10 users per page
const getUsers = async (page) => {
  const users = await User.find({
    is_admin: false,
  })
    .skip((page - 1) * 10)
    .limit(10);
  return users.map((item) => {
    return {
      firstName: item.firstName,
      lastName: item.lastName,
      credits: item.credits,
      email: item.email,
    };
  });
};

// find user on email and update the details provided in arguments

const updateUser = async (email, firstName, lastName, credits) => {
  const user = await User.findOne({
    email: email,
  });
  if (!user) return false;

  user.firstName = firstName;
  user.lastName = lastName;
  user.credits = credits;

  const result = await user.save();
  if (!result) return false;
  return true;
};

// find user on email and delete
const deleteUser = async (email) => {
  const user = await User.findOne({
    email: email,
  });
  if (!user) return false;

  const result = await user.delete();
  if (!result) return false;
  return true;
};

const checkAdmin = async (username) => {
  const user = await User.findOne({
    username: username,
  });
  if (!user) return false;
  return user.is_admin;
};

const get_daily_count = async (username, start_date, end_date) => {
  let counts_aggregate = VerificationQuery.aggregate([]);
  if (username != undefined) {
    counts_aggregate = counts_aggregate.match({
      user: mongoose.Types.ObjectId(username),
    });
  }

  const counts = await counts_aggregate
    .match({
      timestamp: {
        $gte: start_date,
        $lte: end_date,
      },
    })
    .group({
      _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
      total: { $sum: { $add: ["$valid_count", "$invalid_count"] } },
      count: { $sum: 1 },
    })
    .project({
      timestamp: 1,
      total: 1,
      count: 1,
    })
    .sort({ _id: 1 });

  const getDates = (d1, d2) => {
    var oneDay = 24 * 3600 * 1000;
    for (var d = [], ms = d1 * 1, last = d2 * 1; ms <= last; ms += oneDay) {
      d.push(new Date(ms));
    }
    return d;
  };

  let countsDict = {};
  counts.forEach((item) => {
    countsDict[item._id] = item;
  });

  let dates = getDates(start_date, end_date);
  return dates.map((item) => ({
    _id: item.toISOString().slice(0, 10),
    total: (countsDict[item.toISOString().slice(0, 10)] || {})["total"] || 0,
    count: (countsDict[item.toISOString().slice(0, 10)] || {})["count"] || 0,
  }));
};

const get_daily = async (username, start_date, end_date, page, limit) => {
  let counts_aggregate = Verification.aggregate([]);

  if (username != undefined) {
    counts_aggregate = counts_aggregate.match({
      user: mongoose.Types.ObjectId(username),
    });
  }
  let count = 0;
  await Verification.aggregate([
    {
      $match: {
        verified_on: {
          $gte: start_date,
          $lte: end_date,
        },
      },
    },
    {
      $count: "count",
    },
  ]).then((result) => {
    if (result.length != 0) {
      count = result[0].count;
    }
  });


  const data = await Verification.find({
    verified_on: {
      $gte: start_date,
      $lte: end_date,
    },
  })
    .limit(limit)
    .skip((page - 1) * 10);

  return { data: data, count: count, page: page };
};

const deductCredits = async (username, credits) => {
  const user = await User.findOne({
    username: username,
  });
  if (!user) return false;

  if (user.credits - credits < 0) {
    return false;
  }
  user.credits = user.credits - credits;
  user.consumed_credits = user.consumed_credits + credits;
  const result = await user.save();
  if (!result) return false;
  return true;
};

const getCredits = async (username) => {
  const user = await User.findOne({
    username: username,
  });
  if (!user) return null;
  return user.credits;
};

export {
  userSignup,
  addVerificationToUser,
  checkAdmin,
  createQuery,
  removeInProgress,
  get_daily_count,
  get_daily,
  getUserQuery,
  getUserQueries,
  getUserQueriesPagination,
  getEmailsByFileID as getVerificationByID,
  getUsers,
  getUsersCount,
  updateUser,
  deleteUser,
  deductCredits,
  getCredits,
};
