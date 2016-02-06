import Firebase from "firebase"

export default class {
  constructor(){
    this.ref = new Firebase("http://thridsta.firebaseio.com")
  }
  media(){
    let mediaRef = this.ref.child("media").orderByChild("time").limitToLast(40)
    return new Promise( (resolve, reject) => {
      mediaRef.once("value", (snap) => {
        resolve(Object.values(snap.val()))
      })
    })
  }
}