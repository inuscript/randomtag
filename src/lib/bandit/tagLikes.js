export default function tagLikes (media) {
  return media.reduce((results, m) => {
    let mediaTags = m.tags || []
    mediaTags.map((tag) => {
      let t = results[tag] || []
      t.push(m.like)
      results[tag] = t
    })
    return results
  }, {})
}
