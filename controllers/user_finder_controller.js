import { User } from "../models/user.js";
import { FinderQuery } from "../models/finder_query.js";
import mongoose from "mongoose";

const createQuery = async (username, filename, timestamp, firebase_key) => {
  const user = await User.findOne({
    username: username,
  });
  if (!user) return false;

  const query = new FinderQuery({
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
  invalid_count
) => {
  await FinderQuery.findOneAndUpdate(
    { _id: mongoose.Types.ObjectId(query_id) },
    {
      $set: {
        emails: emails,
        valid_count: valid_count,
        invalid_count: invalid_count,
      },
    }
  );
  return true;
};

const removeInProgress = async (query_id) => {
  await FinderQuery.findOneAndUpdate(
    { _id: mongoose.Types.ObjectId(query_id) },
    {
      $set: {
        firebase_key: null,
      },
    }
  );
  return true;
};

const getUserQuery = async (username, filename, timestamp) => {
  const user = await User.findOne({
    username: username,
  });
  if (!user) return null;

  const query = await FinderQuery.findOne({
    user: user._id,
    filename: filename,
    timestamp: timestamp,
  });

  return query;
};

const getUserQueries = async (username) => {
  const user = await User.findOne({
    username: username,
  });
  if (!user) {
    return [];
  }

  const queries = await FinderQuery.find({
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
  const queries = await FinderQuery.find({
    user: user._id,
  })
    .skip((page - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .sort({ timestamp: -1 });

  const page_count =
    ((await FinderQuery.countDocuments({
      user: user._id,
    })) -
      1) /
    PAGE_SIZE;

  return {
    queries: queries,
    page_count: page_count,
  };
};

const getEmailsByFileID = async (username, id, filename) => {
  const user = await User.findOne({
    username: username,
  });
  if (!user) return [];

  const query = await FinderQuery.findOne({
    user: user._id,
    date: id,
    filename: filename,
  });
  return query.emails;
};

// get all user in pagination with 10 users per page

// find user on email and update the details provided in arguments

// find user on email and delete

const get_daily_count = async (username, start_date, end_date) => {
  let counts_aggregate = FinderQuery.aggregate([]);
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

export {
  addVerificationToUser as addFinderResultsToUser,
  createQuery as createFinderQuery,
  removeInProgress as removeInProgressFinder,
  get_daily_count as get_daily_finder_count,
  getUserQuery as getUserQueryFinder,
  getUserQueries as getUserQueriesFinder,
  getUserQueriesPagination as getUserQueriesPaginationFinder,
  getEmailsByFileID as getFinderByID,
};
