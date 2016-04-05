import calcValue from './calcValue'
function calcFlag (counts, mean) {
  return counts.map((c) => {
    return c > mean ? 1 : 0
  })
}

// square mean
// TODO: normalize
export default function normalize (countsObj, threshold) {
  let t = calcValue(countsObj)
  return Object.entries(countsObj).map(([key, counts]) => {
    return {
      key: key,
      values: calcFlag(counts, t)
    }
  })
}
