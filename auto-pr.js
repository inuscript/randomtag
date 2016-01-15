const fs = require("fs")
const GhRepo = require("./script/ghrepo").GhRepo
const GITHUB_ACCESS_TOKEN = process.env.GITHUB_ACCESS_TOKEN
const CIRCLE_ARTIFACTS = process.env.CIRCLE_ARTIFACTS 
const CIRCLE_BUILD_NUM = process.env.CIRCLE_BUILD_NUM 
const CIRCLE_BRANCH = process.env.CIRCLE_BRANCH

if(CIRCLE_BRANCH !== "gh-pages"){
  return // exit
}

const targetFiles = [
  "tags.txt"
]
var user = "inuscript"
var repo = "randomtag"
var token = GITHUB_ACCESS_TOKEN
var toBranch = `auto-pr-${CIRCLE_BUILD_NUM}`
var fromBranch = "gh-pages"

// load file
const files = targetFiles.map( (file) => {
  return {
    path: file,
    // content: fs.readFileSync(`${CIRCLE_ARTIFACTS}/${file}`, 'utf-8'),
    content: fs.readFileSync(`${file}`, 'utf-8'),
  }
})

var pr = new GhRepo(user, repo, token)
pr.touchBranch(fromBranch, toBranch)
// pr.pullRequest(fromBranch, toBranch)
  .then( (res) => {
    console.log(res)
  }).catch( (e) => {
    console.log(e)
  })