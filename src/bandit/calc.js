import { UCBBandit } from "@inuscript/to-zok"

export default function bandit(tags, normalize){
  let bandit = new UCBBandit( tags )
  normalize.forEach( ({tag, count}) => {
    count.forEach( c => {
      bandit.reward(tag, c)
    })
  })
  return bandit
}