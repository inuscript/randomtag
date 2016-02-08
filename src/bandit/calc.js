import { UCBBandit } from "@inuscript/to-zok"
import tagNormalized from "../storage/tags"

export default function bandit(tags, media){
  let n = tagNormalized(media)
  let bandit = new UCBBandit( tags )
  n.forEach( ({tag, count}) => {
    count.forEach( c => {
      bandit.reward(tag, c)
    })
  })
  return bandit
}