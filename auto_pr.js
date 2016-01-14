const GITHUB_ACCESS_TOKEN = process.env.GITHUB_ACCESS_TOKEN
const CIRCLE_PROJECT_USERNAME = process.env.CIRCLE_PROJECT_USERNAME
const CIRCLE_PROJECT_REPONAME = process.env.CIRCLE_PROJECT_REPONAME 
const CIRCLE_BUILD_NUM = process.env.CIRCLE_BUILD_NUM
const CIRCLE_ARTIFACTS = process.env.CIRCLE_ARTIFACTS 

console.log(GITHUB_ACCESS_TOKEN, CIRCLE_PROJECT_USERNAME, CIRCLE_PROJECT_REPONAME , CIRCLE_BUILD_NUM, CIRCLE_ARTIFACTS)
const BASE_URL = "https://circle-artifacts.com"
const url = `${BASE_URL}/gh/${CIRCLE_PROJECT_USERNAME}/${CIRCLE_PROJECT_REPONAME}/${CIRCLE_BUILD_NUM}/artifacts/0${CIRCLE_ARTIFACTS}/tags.txt`

console.log(url)

const items = fs.readFileSync(`CIRCLE_ARTIFACTS/tags.txt`)
console.log(items)

// https://circle-artifacts.com/gh/inuscript/randomtag/22/artifacts/0/home/ubuntu/randomtag/tags.txt