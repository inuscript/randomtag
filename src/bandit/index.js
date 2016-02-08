import Storage from "../storage/firebase"
import masterTag, { primary as primaryTag } from "@inuscript/dogtag"
import calcBandit from "./calc"

export function bandit(){
  let str = new Storage()
  return str.media().then( _m => {
    let media = _m.sort( (a, b) => a.time < b.time)
    return media
  }).then( media => {
    return masterTag().then( tags => {
      return calcBandit(tags, media)
    })
  })
}

export default function(num = 25){
  console.debug("use bandit logic")
  return bandit().then( bandit => {
    let tags = bandit.select().splice(0, num)
    return { 
      tags: primaryTag.concat(tags), 
      bandit
    }
  })
}