import calcBandit from './calc'
import tagLikes from '../storage/tagLikes'
import fetchData from "./fetch"

function repeatArray(item, num){
  return new Array(num).fill('_').reduce( (curr) => {
    return curr.concat(item)
  }, [])
}

export default class Bandit {
  constructor() {
    this.num = 25
    this.repeat = 20
    this.threshold = null
  }
  execute(){
    return fetchData().then( ([media, tags, primaryTags]) => 
      this.calc(media, tags, primaryTags) 
    )
  }
  calc(media, tags, primaryTags){
    // TODO きたない
    let bandit = this.bandit(media, tags)
    return this.result(bandit, primaryTags)
  }
  result(bandit, primaryTags){
    let result = bandit.serialize()
    let tags = result.concat().map( v => v.label)
    let primaries = primaryTags.map( (tag) => {
      return { label: tag }
    })
    let tagLabels = result.concat(primaries).map( v => {
      return {
        label : v.label,
        num : v.count / this.repeat
      }
    })
    return {
      tags: primaryTags.concat(tags),
      tagLabels: tagLabels,
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

