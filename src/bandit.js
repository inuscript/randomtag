import {UCBBandit} from "@inuscript/to-zok"

function tagLikes(media){
  let tags = {}
  media.map( (m) => {
    m.tags.map( (tag) => {
      let t = tags[tag] || []
      t.push(m.like)
      tags[tag] = t
    })
  })
  return tags
}

function normalized(sample){
  let likes = media.map( (m) => media.like)
  let max = Math.max.apply(null, likes)
  let min = Math.min.apply(null, likes)
  let tl = tagLikes(sample)
  return Object.entries(tl).map( ([tag, counts]) => {
    let norm = counts.map( (c) => (c - min) / (max - min))
    return {
      tag: tag,
      count: norm
    }
  })
}

export default function bandit(tags, media){
  let n = normalized(media)
  let b = new UCBBandit( tags )
  n.forEach( ({tag, count}) => {
    count.forEach( c => b.reward(tag, c))
  })
  return b.select()
}