
function tagLikes(media){
  return media.reduce( (tags, m) => {
    m.tags.map( (tag) => {
      let t = tags[tag] || []
      t.push(m.like)
      tags[tag] = t
    })
    return tags
  }, {})
}

export default function tagNormalized(media){
  let likes = media.map( (m) => m.like )
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