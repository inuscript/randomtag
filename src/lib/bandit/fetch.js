import Storage from 'lib/storage/firebase'
import masterTag, { primary } from '@inuscript/dogtag'

function fetchMedia () {
  let str = new Storage()
  return str.media().then((m) => {
    let media = m.sort((a, b) => a.time < b.time)
    return media
  })
}

export default function fetchData(){
  return Promise.all([
    fetchMedia(), masterTag(), primary
  ])
}