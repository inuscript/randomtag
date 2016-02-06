import { UCBBandit } from "@inuscript/to-zok"

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

function normalized(media){
  let likes = media.map( (m) => m.like)
  let max = Math.max.apply(null, likes)
  let min = Math.min.apply(null, likes)
  let tl = tagLikes(media)
  return Object.entries(tl).map( ([tag, counts]) => {
    let norm = counts.map( (c) => (c - min) / (max - min))
    return {
      tag: tag,
      count: norm
    }
  })
}

export default function bandit(tags, media){
  console.log("use bandit")

  let n = normalized(media)

  let b = new UCBBandit( tags )
  n.forEach( ({tag, count}) => {
    count.forEach( c => b.reward(tag, c))
  })
  return b.select()
}