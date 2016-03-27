import { UCBBandit } from '@inuscript/to-zok'

export default function bandit (tags, normalize) {
  let bandit = new UCBBandit(tags)
  normalize.forEach(({tag, count}) => {
    count.forEach(c => {
      for (let i = 0; i < 20; i++) {
        bandit.reward(tag, c)
      }
    })
  })
  return bandit
}
