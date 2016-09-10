# Notification Worker

Listens to Firebase queue tasks and based on creation of new messages, **worker** processes them and sends appropriate notifications to the recipients.

## How to run
To Install:
```
npm install
```

To run:
```
npm start
```

## API Signature
```
curl -X POST -d '{"chatID": "chatIDGoesHere", "messageID": "MessageIDgoesHere", "senderDisplayName":"Dave"}' https://fir-bazaar.firebaseio.com/messagesQueue/tasks.json
```