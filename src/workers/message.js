// TODO: Test this monolith. The reason it’s tough to break up into smaller
// testable units is because there are so many variables that depend on one
// another. Automocking from Jest will be great here!

import fetch from 'node-fetch'
import Debugger from 'debug'
import { Sender, Message } from 'node-gcm'
import firebase from 'firebase'
import firebaseApp from '../firebaseApp'

const config = require('../../config') // eslint-disable-line import/no-commonjs

const debug = new Debugger('firebase-queue-jobs:notification')
const fcmSender = new Sender(config.fcmApiKey)
const db = firebaseApp.database()

/**
 * We use an anonymous function here to wrap our actual worker function which
 * is an async function.
 */
export default (data, progress, resolve, reject) => {
  // Actually do the work…
  messageWorker(data)
    .then(resolve)
    .catch(error => {
      debug(error)
      reject(error)
    })
}

/**
 * This is the worker function we actually call. It is an async function for
 * authoring simplicity. In our actual worker, we call this and then add
 * then/catch handlers.
 */
async function messageWorker ({ chatId, messageId, senderDisplayName }) {
  // ========================================================================
  // Validate data and fetch dependencies.
  // ========================================================================
  const chatID = chatId
  const messageID = messageId

  debug(`Processing notification for message '${messageID}' in chat '${chatID}'.`)

  // Validate the incoming data…
  if (!chatID || !messageID)
    throw new Error('Invalid arguments')

  const message = (await db.ref(`messages/${chatID}/${messageID}`).once('value')).val()

  // ========================================================================
  // Get the users who will receive this message.
  // ========================================================================

  // Get the snapshot of all users in this chat.
  const chatUsers = (await db.ref(`chatMembers/${chatID}`).once('value')).val()

  // The array of all the user ids we will notify.
  const recipientUserIDs =
    Object.keys(chatUsers)
      // Filter out the users with a falsy value.
      .filter(userID => chatUsers[userID])
      // Filter out the sender.
      .filter(userID => userID !== message.sender)

  // ========================================================================
  // Do some stuff in parallel.
  // ========================================================================

  await Promise.all([
    // ======================================================================
    // Send push notifications to all recipients.
    // ======================================================================

    (async () => {
      // Get all the push tokens for each user.
      const usersPushTokens = await Promise.all(recipientUserIDs.map(userID =>
        db.ref(`userPushTokens/${userID}/`).once('value')
          .then(snapshot =>
            Object.keys(snapshot.val() || {})
              .map(token => ({ token, ref: snapshot.ref.child(token) })))))
      // Flatten our array!
      const allPushTokens = usersPushTokens.reduce((a, b) => a.concat(b), [])
      // ====================================================================
      // Create our FCM message.
      // ====================================================================

      const fcmMessage = new Message({
        notification: {
          title: "Bazaar",
          body: message.text,
          badge: 1,
          sound: "default"
        },
        "priority": "high",
      })

      // ====================================================================
      // Send a message to our push tokens.
      // ====================================================================

      // If there are no push tokens, silently return…
      if (allPushTokens.length === 0) {
        debug(`Sent notifications to 0 push tokens for message '${messageID}' in chat '${chatID}'.`)
        return
      }

      // Group the tokens into chunks of 1000 to prevent hitting the FCM 1000
      // token limit.
      const pushTokenChunks = allPushTokens.reduce((chunks, pushToken) => {
        const lastChunk = chunks[chunks.length - 1]

        // If the chunk has 1000 tokens in it or more already, add a new chunk
        // with this push token as the seed. If there are less then 1000
        // tokens add it to this chunk.
        if (lastChunk.length >= 1000) chunks.push([pushToken])
        else lastChunk.push(pushToken)

        return chunks
      }, [[]])

      // Send a request to FCM for all of our chunks.
      await Promise.all(pushTokenChunks.map(async pushTokens => {
        // Send our message to the FCM servers, make sure all of our push
        // tokens get sent. Note that there will be no more push tokens then
        // 1000 so we don’t hit the upper limit.
        const response =
          // Convert this callback to a promise.
          await new Promise((resolve, reject) =>
            fcmSender.send(
              fcmMessage,
              { registrationTokens: pushTokens.map(({ token }) => token) },
              (errorCode, data) => {
                if (errorCode) reject(new Error(`FCM failed and responded with status code ${errorCode}`))
                else {
                  resolve(data)
                }
              }))

        // Destructure the data we get back…
        const { success, failure, results } = response

        debug(`Sent notifications to ${pushTokens.length} push tokens for message '${messageID}' in chat '${chatID}' with ${success} success(es) and ${failure} failure(s).`)
      }))
    })(),
  ])
}
