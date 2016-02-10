

const flattenObj = (obj) => {
  return Object.entries(obj).reduce((curr, [key, counts]) => {
    return curr.concat(counts)
  }, [])
}

// square mean
// TODO: normalize
export default function tagNormalized(countsObj){
  let flatten = flattenObj(countsObj)
  let pow = flatten.map( i => i * i)
  let max = Math.max.apply(null, pow)
  let min = Math.min.apply(null, pow)
  return Object.entries(countsObj).map( ([key, counts]) => {
    let norm = counts.map( (_c) => {
      let c = _c * _c
      return (c - min) / (max - min)
    })
    return {
      key: key,
      values: norm
    }
  })
}