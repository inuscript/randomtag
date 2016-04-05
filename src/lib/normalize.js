
function calcValue (counts, mean) {
  return counts.map((c) => {
    return c > mean ? 1 : 0
  })
}

// square mean
// TODO: normalize
export default function normalize (countsObj, threshold) {
  return Object.entries(countsObj).map(([key, counts]) => {
    return {
      key: key,
      values: calcValue(counts, threshold)
    }
  })
}
