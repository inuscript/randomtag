import Firebase from "firebase"

export default class {
  constructor(){
    this.ref = new Firebase("http://thridsta.firebaseio.com")
  }
  media(num = 60){
    let mediaRef = this.ref.child("media").orderByChild("time").limitToLast(num)
    return new Promise( (resolve, reject) => {
      mediaRef.once("value", (snap) => {
        let items = Object.values(snap.val())
        resolve(items)
      })
    })
  }
}