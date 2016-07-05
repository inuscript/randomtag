// import Firebase from 'firebase'
var firebase = require('firebase')
firebase.initializeApp({
  // apiKey: "apiKey",
  // authDomain: "thirdsta.firebaseapp.com",
  databaseURL: "https://thirdsta.firebaseio.com"
})
console.log(firebase.database())
export default class {
  constructor () {
    this.ref = new Firebase('http://thridsta.firebaseio.com/messages')
  }
  media () {
    // after 2015-12-28
    let start = new Date(2015, 11, 28).getTime()
    let end = new Date().getTime() - 1000 * 60 * 60 * 12 // - half day
    let mediaRef = this.ref
      .child('media')
      .orderByChild('time')
      .startAt(start)
      .endAt(end)
    return new Promise((resolve, reject) => {
      mediaRef.once('value', (snap) => {
        let items = Object.values(snap.val())
        resolve(items)
      })
    })
  }
}

