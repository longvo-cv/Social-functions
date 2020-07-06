const { db } = require('../util/admin');
exports.getAllWhispers = (req, res) => {
  db.collection('whispers')
    .orderBy('createdAt', 'desc')
    .get()
    .then((data) => {
      let whispers = [];
      data.forEach((doc) => {
        whispers.push({
          body: doc.data().body,
          postId: doc.id,
          userHandle: doc.data().userHandle,
          createdAt: doc.data().createdAt,
          commentCount: doc.data().commentCount,
          likeCount: doc.data().likeCount,
          userImage: doc.data().userImage
        });
      });
      return res.json(whispers);
    })
    .catch((err) => {
      console.error(err);
    });
};
exports.postOneWhisp = (req, res) => {
  if (req.body.body.trim() === '') {
    return res.status(400).json({ body: 'body must not be empty' });
  }
  const newPost = {
    body: req.body.body,
    userHandle: req.user.handle,
    userImage: req.user.imageUrl,
    createdAt: new Date().toISOString(),
    likeCount: 0,
    commentCount: 0
  };
  db.collection('whispers')
    .add(newPost)
    .then((doc) => {
      const resPost = newPost;
      resPost.postId = doc.id;
      res.json(resPost);
    })
    .catch((err) => {
      res.status(500).json({ error: 'something wrong' });
      console.error(err);
    });
};

//Fetch post
exports.getWhisper = (req, res) => {
  let postData = {};
  db.doc(`/whispers/${req.params.postId}`)
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return res.status(404).json({ Error: 'Post not found' });
      }
      postData = doc.data();
      postData.postId = doc.id;
      return db
        .collection('comments')
        .orderBy('createdAt', 'desc')
        .where('postId', '==', req.params.postId)
        .get()
        .then((data) => {
          postData.comments = [];
          data.forEach((doc) => {
            postData.comments.push(doc.data());
          });
          return res.json(postData);
        })
        .catch((err) => {
          console.error(err);
          res.status(500).json({ Error: err.code });
        });
    });
};
//Post a comment to db
exports.commentPost = (req, res) => {
  if (req.body.body.trim() === '') {
    return res.status(400).json({ Comment: 'Can not have empty comment' });
  }
  const newComment = {
    body: req.body.body,
    createdAt: new Date().toISOString(),
    postId: req.params.postId,
    userHandle: req.user.handle,
    userImage: req.user.imageUrl
  };
  console.log(newComment);
  db.doc(`/whispers/${req.params.postId}`)
    .get()
    .then((doc) => {
      if (!doc.exists) return res.status(404).json({ Error: 'Post not found' });
      return doc.ref.update({ commentCount: doc.data().commentCount + 1 });
    })
    .then(() => {
      return db.collection('comments').add(newComment);
    })
    .then(() => {
      res.json(newComment);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ Error: 'Something went wrong' });
    });
};

//Like a post
exports.likePost = (req, res) => {
  console.log('Uptil this point');
  const likeStat = db
    .collection('likes')
    .where('userHandle', '==', req.user.handle)
    .where('postId', '==', req.params.postId)
    .limit(1);
  const postDocument = db.doc(`/whispers/${req.params.postId}`);
  let postData = {};
  postDocument
    .get()
    .then((doc) => {
      if (doc.exists) {
       // console.log(doc.data());
        postData = doc.data();
        postData.postId = doc.id;
        return likeStat.get();
      } else {
        return res.status(404).json({ Error: 'Post not found' });
      }
    })
    .then((data) => {
      if (data.empty) {
        return db
          .collection('likes')
          .add({
            postId: req.params.postId,
            userHandle: req.user.handle
          })
          .then(() => {
            postData.likeCount++;
            return postDocument.update({ likeCount: postData.likeCount });
          })
          .then(() => {
            return res.json(postData);
          });
      } else {
        return res.status(400).json({ Error: 'Already liked' });
      }
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ Error: 'Something went wrong' });
    });
};

exports.unlikePost = (req, res) => {
  const likeStat = db
    .collection('likes')
    .where('userHandle', '==', req.user.handle)
    .where('postId', '==', req.params.postId)
    .limit(1);
  const postDocument = db.doc(`/whispers/${req.params.postId}`);
  let postData = {};
  postDocument
    .get()
    .then((doc) => {
      if (doc.exists) {
        postData = doc.data();
        postData.postId = doc.id;
        return likeStat.get();
      } else {
        return res.status(404).json({ Error: 'Post not found' });
      }
    })
    .then((data) => {
      if (data.empty) {
        return res.status(400).json({ Error: 'Already liked' });
      } else {
        return db
          .doc(`/likes/${data.docs[0].id}`)
          .delete()
          .then(() => {
            postData.likeCount--;
            return postDocument.update({ likeCount: postData.likeCount });
          })
          .then(() => {
            res.json(postData);
          })
          .catch((err) => {
            console.error(err);
            res.status(500).json({ Error: 'Something went wrong' });
          });
      }
    });
};

//delete a post
exports.deletePost = (req, res) => {
  const document = db.doc(`/whispers/${req.params.postId}`);
  document
    .get()
    .then((doc) => {
      if (!doc.exists) return res.status(404).json({ Error: 'Post not found' });
      if (doc.data().userHandle !== req.user.handle)
        return res.status(403).json({ Error: 'Unauthorized' });
      else {
        return document.delete();
      }
    })
    .then(() => {
      res.json({ messsage: 'Post deleted' });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ Error: err.code });
    });
};
