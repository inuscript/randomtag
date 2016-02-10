import { std, mean } from "mathjs"
const flattenObj = (obj) => {
  return Object.values(obj).reduce((curr, [counts]) => {
    return curr.concat(counts)
  }, [])
}

function normalize(counts, std, mean){
  return counts.map( (c) => {
    return (c - mean) / std
  })
}
// square mean
// TODO: normalize
export default function tagNormalized(countsObj){
  let flatten = flattenObj(countsObj)
  let s = std(flatten)
  let m = mean(flatten)
  console.log(m, s)
  let result = Object.entries(countsObj).map( ([key, counts]) => {
    return {
      key: key,
      values: normalize(counts, s, m)
    }
  })
  let vs = result.map( ({ values }) => values )
  console.log(vs, std(vs), mean(vs))
  return result 
}