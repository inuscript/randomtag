import Storage from '../storage/firebase'
import masterTag, { primary as primaryTag } from '@inuscript/dogtag'
import calcBandit from './calc'
import tagLikes from '../storage/tagLikes'
import normalize from '../lib/normalize'

function fetchMedia () {
  let str = new Storage()
  return str.media().then((m) => {
    let media = m.sort((a, b) => a.time < b.time)
    return media
  })
}

function bandit (media, masterTags, threshold, repeat) {
  let tl = tagLikes(media)
  let normalized = normalize(tl, threshold).map(r => {
    return {
      tag: r.key,
      count: r.values
    }
  })
  return calcBandit(masterTags, normalized, repeat)
}

export function fetchData(){
  return Promise.all([
    fetchMedia(), masterTag()
  ])
}
export class Bandit {
  constructor() {
    this.num = 25
    this.repeat = 20
    this.threshold = null
  }
  calc(){
    
  }
}

export default function (num = 25, threshold = null, repeat = 20) {
  // console.debug('use bandit logic')
  return fetchData().then(([media, tags]) => {
    return bandit(media, tags, threshold, repeat)
  }).then(bandit => {
    let result = bandit.serialize()
    let tags = result.concat().map( v => v.label)
    let tagLabels = result.concat().map( v => {
      return {
        label : v.label,
        num : v.count / repeat
      }
    })
    return {
      tags: primaryTag.concat(tags),
      tagLabels: tagLabels,
      stats: result,
      n: bandit.n
    }
  })
}
