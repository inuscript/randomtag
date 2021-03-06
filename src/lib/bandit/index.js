import calcBandit from './calc'
import tagLikes from 'lib/bandit/tagLikes'
import fetchData from "./fetch"

function repeatArray(item, num){
  return new Array(num).fill('_').reduce( (curr) => {
    return curr.concat(item)
  }, [])
}

class Bandit {
  constructor({media, tags, primaryTags}) {
    this.num = 25
    this.repeat = 20
    this.threshold = null
    this.media = media
    this.tags = tags
    this.primaryTags = primaryTags
  }
  calc(){
    // TODO きたない
    let bandit = this.bandit(this.media, this.tags)
    return this.result(bandit, this.primaryTags)
  }
  result(bandit, primaryTags){
    let result = bandit.serialize()
    let primaries = primaryTags.map( (tag) => {
      return { label: tag }
    })
    let tagLabels = primaries.concat(result).map( ({label, count, expectation}) => {
      return {
        label,
        exp: expectation,
        num: (count / this.repeat)
      }
    })
    return {
      hashTags: tagLabels,
      stats: result,
      n: bandit.n
    }
  }
  normalize (countsObj) {
    return Object.entries(countsObj).map(([key, counts]) => {
      let values = counts.map((c) =>  c > this.threshold ? 1 : 0)
      return { key, values }
    })
  }

  bandit (media, masterTags) {
    let tl = tagLikes(media)
    let normalized = this.normalize(tl).map(r => {
      return {
        tag: r.key,
        count: repeatArray(r.values, this.repeat)
      }
    })
    return calcBandit(masterTags, normalized)
  }
}

export default function build(){
  return fetchData().then( ([media, tags, primaryTags]) => {
    return new Bandit({media, tags, primaryTags})
  })
}
