import Storage from '../storage/firebase'
import masterTag, { primary as primaryTag } from '@inuscript/dogtag'
import calcBandit from './calc'
import tagLikes from '../storage/tagLikes'
import normalize from '../lib/normalize'

function fetchMedia () {
  let str = new Storage()
  return str.media().then(_m => {
    let media = _m.sort((a, b) => a.time < b.time)
    return media
  })
}

function bandit (media, masterTags) {
  let tl = tagLikes(media)
  let normalized = normalize(tl).map(r => {
    return {
      tag: r.key,
      count: r.values
    }
  })
  return calcBandit(masterTags, normalized)
}

export default function (num = 25) {
  console.debug('use bandit logic')
  return Promise.all([
    fetchMedia(), masterTag()
  ]).then(([media, tags]) => {
    return bandit(media, tags)
  }).then(bandit => {
    let result = bandit.serialize()
    let tags = result.concat().map(v => v.label)
    return {
      tags: primaryTag.concat(tags),
      stats: result,
      n: bandit.n
    }
  })
}
