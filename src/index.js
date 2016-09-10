import Debugger from 'debug'
import Queue from 'firebase-queue'
import firebaseApp from './firebaseApp'
import messageWorker from './workers/message'

const debug = new Debugger('firebase-queue-jobs')

debug(`Starting queues in ${process.env.NODE_ENV}`) // eslint-disable-line no-process-env

const messageQueue = new Queue(
  firebaseApp.database().ref('messagesQueue'),
  messageWorker,
)

// Intercept termination signal so that we can shutdown our queues and prevent
// wierd states from happening.
process.on('SIGINT', () => {
  debug('Starting queue shutdown')
  Promise.all([
    messageQueue.shutdown(),
  ])
    .then(() => {
      debug('Finished queue shutdown')
      process.exit(0) // eslint-disable-line no-process-exit, xo/no-process-exit
    })
    .catch(() => {
      debug('Failed queue shutdown')
      process.exit(0) // eslint-disable-line no-process-exit, xo/no-process-exit
    })
})
