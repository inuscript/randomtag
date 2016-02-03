import axios from "axios"
import Chance from "chance"
const primaryTag = ["dog", "norfolkterrier"]

function shuffle(tags){
  let chance = new Chance()
  return chance.shuffle(tags)
}

export default function(num = 25){
  return axios("./tags.txt").then( res => {
    return res.data.split("\n").filter(function(tag){
      return tag.length > 0
    })
  }).then(tags => {
    return shuffle(tags).splice(0, num)
  }).then(tags => {
    return primaryTag.concat(tags)
  })
}