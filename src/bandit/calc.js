import { UCBBandit } from '@inuscript/to-zok'

export default function bandit (tags, normalize, repeat = 20) {
  let bandit = new UCBBandit(tags)
  normalize.forEach(({tag, count}) => {
    count.forEach(c => {
      for (let i = 0; i < repeat; i++) {
        bandit.reward(tag, c)
      }
    })
  })
  return bandit
}
