const functions = require('firebase-functions');
const FBAuth = require('./util/FBAuth');
const express = require('express');
const app = express();
const cors = require('cors');
app.use(cors());

const { db } = require('./util/admin');
const {
  getAllWhispers,
  postOneWhisp,
  getWhisper,
  commentPost,
  likePost,
  unlikePost,
  deletePost
} = require('./handlers/whispers');
const {
  signUp,
  logIn,
  uploadImg,
  addUserDetail,
  getAuthenticatedUser,
  getUserDetail,
  markNotiRead
} = require('./handlers/users');


//Route to get whispers
app.get('/whispers', getAllWhispers);
app.post('/whisper', FBAuth, postOneWhisp);
app.get('/whisper/:postId', getWhisper);
app.post('/whisper/:postId/comment', FBAuth, commentPost);
app.get('/whisper/:postId/like', FBAuth, likePost);
app.get('/whisper/:postId/unlike', FBAuth, unlikePost);
app.delete(`/whisper/:postId`, FBAuth, deletePost);
//Like a post

//users
app.post('/signup', signUp);
app.post('/login', logIn);
app.post('/user/image', FBAuth, uploadImg);
app.post('/user', FBAuth, addUserDetail);
app.get('/user', FBAuth, getAuthenticatedUser);
app.get('/user/:handle', getUserDetail);
app.post('/notifications', FBAuth, markNotiRead);

exports.api = functions.https.onRequest(app);

exports.createNotificationOnLike = functions
  .region('us-central1')
  .firestore.document('likes/{id}')
  .onCreate((snapshot) => {
    return db
      .doc(`/whispers/${snapshot.data().postId}`)
      .get()
      .then((doc) => {
        if (
          doc.exists &&
          doc.data().userHandle !== snapshot.data().userHandle
        ) {
          return db.doc(`/notifications/${snapshot.id}`).set({
            createdAt: new Date().toISOString(),
            recipient: doc.data().userHandle,
            sender: snapshot.data().userHandle,
            type: 'like',
            read: false,
            postId: doc.id
          });
        }
      })
      .catch((err) => console.error(err));
  });

exports.delteNotiOnUnlike = functions
  .region('us-central1')
  .firestore.document('likes/{id}')
  .onDelete((snapshot) => {
    return db
      .doc(`/notifications/${snapshot.id}`)
      .delete()
      .catch((err) => {
        console.error(err);
        return;
      });
  });

exports.createNotificationOnComment = functions
  .region('us-central1')
  .firestore.document('comments/{id}')
  .onCreate((snapshot) => {
    return db
      .doc(`/whispers/${snapshot.data().postId}`)
      .get()
      .then((doc) => {
        if (
          doc.exists &&
          doc.data().userHandle !== snapshot.data().userHandle
        ) {
          return db.doc(`/notifications/${snapshot.id}`).set({
            createdAt: new Date().toISOString(),
            recipient: doc.data().userHandle,
            sender: snapshot.data().userHandle,
            type: 'comment',
            read: false,
            postId: doc.id
          });
        }
      })
      .catch((err) => {
        console.error(err);
      });
  });
exports.onUserImgChange = functions
  .region('us-central1')
  .firestore.document('/users/{userID}')
  .onUpdate((change) => {
    console.log(change.before.data());
    console.log(change.after.data());
    if (change.before.data().imageUrl !== change.after.data().imageUrl) {
      console.log('Image url changed');
      const batch = db.batch();
      return db
        .collection(`whispers`)
        .where('userHandle', '==', change.before.data().handle)
        .get()
        .then((data) => {
          data.forEach((doc) => {
            const post = db.doc(`/whispers/${doc.id}`);
            batch.update(post, { userImage: change.after.data().imageUrl });
          });
          return batch.commit();
        });
    } else return true;
  });

exports.onPostDelete = functions
  .region('us-central1')
  .firestore.document('/whispers/{postId}')
  .onDelete((snapshot, context) => {
    const postId = context.params.postId;
    let batch = db.batch();
    return db
      .collection('comments')
      .where('postId', '==', postId)
      .get()
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/comments/${doc.id}`));
        });
        return db
          .collection('likes')
          .where('postId', '==', postId)
          .get();
      })
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/likes/${doc.id}`));
        });
        return db
          .collection('notifications')
          .where('postId', '==', postId)
          .get();
      })
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/notifications/${doc.id}`));
        });
        return batch.commit();
      })
      .catch((err) => {
        console.error(err);
      });
  });
