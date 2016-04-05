import { mean } from 'mathjs'
const flattenObj = (obj) => {
  return Object.values(obj).reduce((curr, [counts]) => {
    return curr.concat(counts)
  }, [])
}

function normalize (counts, mean) {
  return counts.map((c) => {
    return c > mean ? 1 : 0
  })
}

// square mean
// TODO: normalize
export default function tagNormalized (countsObj, threshold = null) {
  let flatten = flattenObj(countsObj)
  let m = mean(flatten) * 1.2
  if (threshold) {
    m = threshold
  }
  return Object.entries(countsObj).map(([key, counts]) => {
    return {
      key: key,
      values: normalize(counts, m)
    }
  })
}
