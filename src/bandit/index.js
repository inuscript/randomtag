import Storage from "./firebase"
import masterTag from "../lib/tags"
import calcBandit from "./calc"
import primaryTag from "../lib/primary"

export default function(num = 25){
  let str = new Storage()
  return str.media().then( _m => {
    let media = _m.sort( (a, b) => a.time > b.time)
    media.pop()
    return media
  }).then( media => {
    return masterTag().then( tags => {
      return calcBandit(tags, media)
    })
  }).then( tag => {
    return tag.splice(0, num)
  }).then( tag => {
    return primaryTag.concat(tag)
  })
}