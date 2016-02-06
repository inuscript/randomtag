import Firebase from "firebase"

export default class {
  constructor(){
    this.ref = new Firebase("http://thridsta.firebaseio.com")
  }
  media(){
    return this.ref.child("media").orderByValue().once("value", (item) => {
      console.log(Object.keys(item.val()))
    })
  }
}