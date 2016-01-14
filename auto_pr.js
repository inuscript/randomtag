const fs = require("fs")
const github = require("github-basic")
const GITHUB_ACCESS_TOKEN = process.env.GITHUB_ACCESS_TOKEN
const CIRCLE_ARTIFACTS = process.env.CIRCLE_ARTIFACTS 

const file = fs.readFileSync(`${CIRCLE_ARTIFACTS}/tags.txt`, 'utf-8')
var client = github({version: 3, 
  auth: GITHUB_ACCESS_TOKEN
})
var user = "inuscript"
var repo = "randomtag"

client.exists(user, repo, (err, res) => {
  console.log(err, res)
})

client.get(`/repos/${user}/${repo}/issues`, {}, (err, res) => {
  if (err) throw err;
  console.dir(res)
})