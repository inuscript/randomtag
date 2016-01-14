const fs = require("fs")
const github = require("github-basic")
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
var branchName = `auto-pr-${CIRCLE_BUILD_NUM}`
var fromBranch = "gh-pages"

// load file
const files = targetFiles.map( (file) => {
  return {
    path: file,
    // content: fs.readFileSync(`${CIRCLE_ARTIFACTS}/${file}`, 'utf-8'),
    content: fs.readFileSync(`${file}`, 'utf-8'),
  }
})

var client = github({version: 3, auth: token})

client.branch(user, repo, fromBranch, branchName, (err, res) => {
  var option = {
    branch: branchName,
    message: "auto build",
    updates: files
  }
  client.commit(user, repo, option).then( (res) => {
    return client.pull(
      { repo: repo, user: user, branch: branchName},
      { repo: repo, user: user, branch: fromBranch},
      { title: "Auto Build" }
    )
  }).done( (res) => {
    console.log(res)
  })
})
