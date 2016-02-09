import Storage from "../storage/firebase"
import masterTag, { primary as primaryTag } from "@inuscript/dogtag"
import calcBandit from "./calc"
import tagNormalized from "../storage/likes"

export function bandit(){
  let str = new Storage()
  return str.media().then( _m => {
    let media = _m.sort( (a, b) => a.time < b.time)
    return media
  }).then( media => {
    let normalize = tagNormalized(media)

    return masterTag().then( tags => {
      return calcBandit(tags, normalize)
    })
  })
}

export default function(num = 25){
  console.debug("use bandit logic")
  return bandit().then( bandit => {
    let result = bandit.serialize()
    let tags = result.concat().splice(0, num).map( v => v.label )
    return { 
      tags: primaryTag.concat(tags), 
      stats: result
    }
  })
}