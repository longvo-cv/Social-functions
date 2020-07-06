const admin = require('firebase-admin');
let serviceAccount = require('../service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://social-app-d3e5e.firebaseio.com',
  storageBucket: 'social-app-d3e5e.appspot.com'
});
const db = admin.firestore();
module.exports = { admin, db };
