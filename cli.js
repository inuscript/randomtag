import Storage from "./src/firebase"
import masterTag from "./src/masterTags"
import bandit from "./src/bandit"

let str = new Storage()
str.media().then( _m => {
  let media = _m.sort( (a, b) => a.time > b.time)
  media.pop()
  return media
}).then( media => {
  return masterTag().then( tags => {
    return bandit(tags, media)
  })
}).then( tag => {
  console.log(tag)
  process.exit(0)
}).catch( e => {
  console.error(e.stack)
  process.exit(1)
})