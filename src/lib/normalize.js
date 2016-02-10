import { std, mean } from "mathjs"
const flattenObj = (obj) => {
  return Object.values(obj).reduce((curr, [counts]) => {
    return curr.concat(counts)
  }, [])
}

function normalize(counts, mean){
  return counts.map( (c) => {
    return c > mean ? 1 : 0
  })
}

function histogram(flatten){
  let res = {}
  flatten.map( _c => {
    let c = Math.ceil(_c / 10) * 10
    let r = res[c] ? res[c] : 0
    r++
    res[c] = r
  })
  return res
}
// square mean
// TODO: normalize
export default function tagNormalized(countsObj){
  let flatten = flattenObj(countsObj)
  console.log(histogram(flatten))
  let m = mean(flatten)
  return Object.entries(countsObj).map( ([key, counts]) => {
    return {
      key: key,
      values: normalize(counts, m)
    }
  })
}