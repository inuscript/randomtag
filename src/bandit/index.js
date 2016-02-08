import Storage from "./firebase"
import masterTag, { primary as primaryTag } from "@inuscript/dogtag"
import calcBandit from "./calc"

export default function(num = 25){
  console.debug("use bandit logic")
  let str = new Storage()
  return str.media().then( _m => {
    let media = _m.sort( (a, b) => a.time < b.time)
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