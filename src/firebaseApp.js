import firebase from 'firebase'
import config from '../config'

const firebaseAppName = 'firebase-queue-jobs'

const firebaseApp = firebase.initializeApp({
  ...config.firebase
}, firebaseAppName)

export default firebaseApp
