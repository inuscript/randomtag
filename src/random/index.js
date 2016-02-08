import axios from "axios"
import Chance from "chance"
// import bandit from "./bandit"
import tags, { primary as primaryTag } from "@inuscript/dogtag"

function shuffle(tags){
  let chance = new Chance()
  return chance.shuffle(tags)
}

export default function(num = 25){
  return tags().then(tags => {
    return shuffle(tags).splice(0, num)
  }).then(tags => {
    return primaryTag.concat(tags)
  })
}