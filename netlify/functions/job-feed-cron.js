/* The schedule for the Job feed (see job-feed.js). Every 5 minutes: look at a connected careers page that is due (once a day), then read waiting roles into drafts.
   Does nothing until two settings exist in Netlify: FEED_WORKER_SECRET (created in Admin > Job feeds > Daily check) and ANTHROPIC_API_KEY. */
const feed = require('./job-feed.js')._run;

exports.handler = async function () {
  const secret = process.env.FEED_WORKER_SECRET, key = process.env.ANTHROPIC_API_KEY;
  if (!secret || !key) return { statusCode: 200, body: 'off' };
  try {
    const r = await feed.tick(secret, key);
    console.log('job-feed-cron: ' + JSON.stringify(r));
    return { statusCode: 200, body: JSON.stringify(r) };
  } catch (e) {
    console.log('job-feed-cron: failed (' + (e && (e.name || e.message)) + ')');
    return { statusCode: 200, body: 'failed' };
  }
};
