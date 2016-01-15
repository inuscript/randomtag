const fs = require("fs")
const GhRepoBranch = require("./script/ghrepo").GhRepoBranch
const GITHUB_ACCESS_TOKEN = process.env.GITHUB_ACCESS_TOKEN
const CIRCLE_ARTIFACTS = process.env.CIRCLE_ARTIFACTS 
const CIRCLE_BUILD_NUM = process.env.CIRCLE_BUILD_NUM 
const CIRCLE_BRANCH = process.env.CIRCLE_BRANCH
const github = require("github-basic")

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

function sendPRIfNeed(pr, files, toBranch){
  pr.filterDiffFiles(files).then( (files) => {
    if(files.length == 0){
      return Promise.reject("Files is Not change")
    }
    return files
  }).then( (files) => {
    console.log("Send pull request")
    return pr.pullRequest( toBranch, files, `Auto build ${CIRCLE_BUILD_NUM}`)
  }).then( (res) => {
    console.log(res)
  }).catch( (e) => {
    console.log(e)
  })
}

var client = github({version: 3, auth: token})


var pr = new GhRepoBranch(client, user, repo, fromBranch)
sendPRIfNeed(pr, files, toBranch)