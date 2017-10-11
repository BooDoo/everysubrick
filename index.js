#!/usr/bin/env node

// Replace Math.random() with MT-based substitute:
Math.random = require('./mt-rng');

const _ = require('lodash');
const P = require('bluebird');
const request = P.promisifyAll(require('request'));

const creds = require('./credentials');
const Twit = require('twit');
const REST = new Twit(creds.live);
const {URL} = require('url');
const REDDITS = new URL('https://www.reddit.com/reddits');

function getLastId(data) {
  return _.last(data.children).data.id;
}

function getNextPage(endpoint) {
  return request.getAsync({url: endpoint.href, json:true})
  .then(res=> {
    endpoint.searchParams.set('after', `t5_${getLastId(res.body.data)}`);
    return endpoint;
  });
}

function getPagedUrl(endpoint, n, limit=100) {
  return P.reduce(new Array(n), (newest, nextPage)=> {return getNextPage(newest); }, endpoint);
  while (n-- >= 0) promise = promise.then(getNextPage(endpoint));
}

function getSubreddits(type='popular', page=0, limit=100) {
  if (type.indexOf('/')) {type = `/${type}`;}
  let endpoint = new URL(REDDITS.href);
  endpoint.pathname += `${type}.json`;
  endpoint.searchParams.set('limit', limit);

  return getPagedUrl(endpoint, page, limit)
  .then(paged=>request.getAsync({url: paged.href, json: true}))
  .then(res=>res.body.data.children.map(c=>c.data));
}

function getSubreddit(type='popular', page=0, limit=100) {
  return getSubreddits(type, page, limit)
  .then(subreddits=>_.sample(subreddits));
}

function getSubredditName(type='popular', page=0, limit=100) {
  return getSubreddit(type, page, limit).then(subreddit=>subreddit.display_name_prefixed);
}

function getRick() {
  let rick = `r${Array(_.random(10)+2).join('i')}ck${Array(_.random(6)+2).join('!')}`;
  return rick
}

P.all([getSubredditName('popular', _.random(10)), getRick()])
.spread((subreddit, rick) => {
  // pick one from each pool of related words and put it in the snowclone
  let status = `i'm ${subreddit} ${rick}`;
  if (_.random()) status = status.toUpperCase();
  return status;
})
.tap(console.log)
.then(status => REST.post('statuses/update', {status: status}))
.then(res => {
  console.log(`SUBRICK twote:\n${res.data.id_str}, ${res.data.text}`);
})
.catch(console.error);
