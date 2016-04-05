import { mean } from 'mathjs'

const flattenObj = (obj) => {
  return Object.values(obj).reduce((curr, [counts]) => {
    return curr.concat(counts)
  }, [])
}

export default function (countsObj) {
  let flatten = flattenObj(countsObj)

  return mean(flatten) * 1.2
}
