import firebase from 'firebase'
// import Firebase from 'firebase'
export default class {
  constructor () {
    const config = {
      apiKey: "AIzaSyC522es7vT69eg0B-Pd550qNFEmYghLQDA",
      authDomain: "thridsta.firebaseapp.com",
      databaseURL: "https://thridsta.firebaseio.com",
      storageBucket: "thridsta.appspot.com",
      messagingSenderId: "1077449903960"
    };
    firebase.initializeApp(config)
    this.ref = firebase.database().ref()
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

