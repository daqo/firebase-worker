/* eslint-disable import/no-commonjs, no-process-env */

const { NODE_ENV } = process.env

if (NODE_ENV === 'development')
  module.exports = require('./config.development.json')
else if (NODE_ENV === 'production')
  module.exports = require('./config.production.json')
else if (!NODE_ENV)
  throw new Error('The `NODE_ENV` environment variable was not set. Please set `NODE_ENV` to a value like "development" or "production".')
else
  throw new Error(`Environment variable \`NODE_ENV\` has an invalid value of "${NODE_ENV}".`)
