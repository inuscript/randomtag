export default function tagLikes(media){
  return media.reduce( (tags, m) => {
    m.tags.map( (tag) => {
      let t = tags[tag] || []
      t.push(m.like)
      tags[tag] = t
    })
    return tags
  }, {})
}
